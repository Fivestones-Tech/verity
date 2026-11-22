import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import type { StaffContext } from "@/lib/auth/session";
import { DomainError } from "@/lib/api";
import { loadSubjects } from "@/lib/questions/repo";
import { pickQuestions, type PoolQuestion } from "@/lib/assessments/pick";
import type { z } from "zod";
import type { createAssessmentSchema } from "@/lib/validation/assessment";

type Input = z.infer<typeof createAssessmentSchema>;

/** Published questions this centre may use: its own bank plus published platform content. */
export async function questionPool(staff: StaffContext, subjectId: string): Promise<(PoolQuestion & { institution_id: string | null })[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("questions")
    .select("id, topic_id, difficulty, institution_id")
    .eq("subject_id", subjectId)
    .eq("status", "published")
    .or(`institution_id.is.null,institution_id.eq.${staff.institution.id}`);
  return (data ?? []) as (PoolQuestion & { institution_id: string | null })[];
}

/** Topic ids including subtopics, so choosing "Algebra" also pulls "Algebra › Linear equations". */
async function expandTopics(staff: StaffContext, subjectId: string, topicIds: string[]) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("topics")
    .select("id, parent_topic_id, institution_id")
    .eq("subject_id", subjectId)
    .or(`institution_id.is.null,institution_id.eq.${staff.institution.id}`);
  const all = data ?? [];
  const valid = new Set(all.map((t) => t.id));
  const chosen = topicIds.filter((t) => valid.has(t));
  if (chosen.length !== topicIds.length) throw new DomainError("invalid_topic", "One of the topics doesn't belong to this subject.");
  // group subtopics under the chosen parent so the spread is per chosen topic
  const groupOf = new Map<string, string>();
  for (const t of chosen) groupOf.set(t, t);
  for (const t of all) if (t.parent_topic_id && groupOf.has(t.parent_topic_id) && !groupOf.has(t.id)) groupOf.set(t.id, t.parent_topic_id);
  return groupOf;
}

export async function createTopicTest(staff: StaffContext, v: Input) {
  const subjects = await loadSubjects(staff.institution.exam_focus);
  const subject = subjects.find((s) => s.id === v.subject_id);
  if (!subject) throw new DomainError("invalid_subject", "Choose one of your centre's subjects.");
  const groupOf = await expandTopics(staff, subject.id, v.topic_ids);

  const pool = (await questionPool(staff, subject.id))
    .filter((q) => groupOf.has(q.topic_id))
    .map((q) => ({ ...q, topic_id: groupOf.get(q.topic_id)! }));
  const picked = pickQuestions(pool, { topicIds: v.topic_ids, count: v.question_count, difficulties: v.difficulties });
  if (picked.shortBy > 0) {
    throw new DomainError(
      "not_enough_questions",
      `There are only ${picked.ids.length} published questions for these topics${v.difficulties.length ? " and difficulty" : ""}. Choose ${picked.ids.length} or fewer questions, add topics, or publish more questions.`,
    );
  }

  const admin = createSupabaseAdminClient();
  // validate classes belong to this centre
  const classIds = v.assign_to.filter((a) => a !== "all");
  if (classIds.length) {
    const { data: cls } = await admin.from("classes").select("id").eq("institution_id", staff.institution.id).in("id", classIds);
    if ((cls ?? []).length !== classIds.length) throw new DomainError("invalid_class", "Choose classes from your centre.");
  }
  const endAt = v.end_at ? new Date(v.end_at) : null;
  if (endAt && (Number.isNaN(endAt.getTime()) || endAt <= new Date())) {
    throw new DomainError("invalid_end", "The closing time must be in the future.");
  }

  const { data: a, error } = await admin
    .from("assessments")
    .insert({
      institution_id: staff.institution.id,
      created_by: staff.userId,
      examination_id: subject.examination_id,
      subject_id: subject.id,
      name: v.name,
      assessment_type: "topic_test",
      duration_seconds: v.duration_minutes * 60,
      question_count: picked.ids.length,
      attempt_limit: 1,
      status: v.open_now ? "active" : "draft",
      instructions: v.instructions || null,
      start_at: v.open_now ? new Date().toISOString() : null,
      end_at: endAt?.toISOString() ?? null,
    })
    .select("id")
    .single();
  if (error || !a) {
    console.error("[assessments] insert failed", error?.message);
    throw new DomainError("create_failed", "We couldn't create the test. Please try again.", 500);
  }
  const { error: qErr } = await admin
    .from("assessment_questions")
    .insert(picked.ids.map((qid, i) => ({ assessment_id: a.id, question_id: qid, position: i + 1 })));
  const assignments = v.assign_to.includes("all")
    ? [{ assessment_id: a.id, assigned_by: staff.userId }]
    : classIds.map((c) => ({ assessment_id: a.id, class_id: c, assigned_by: staff.userId }));
  const { error: asErr } = await admin.from("assessment_assignments").insert(assignments);
  if (qErr || asErr) {
    console.error("[assessments] children insert failed", qErr?.message, asErr?.message);
    await admin.from("assessments").delete().eq("id", a.id);
    throw new DomainError("create_failed", "We couldn't create the test. Please try again.", 500);
  }
  await audit({
    actorUserId: staff.userId,
    institutionId: staff.institution.id,
    action: v.open_now ? "assessment.published" : "assessment.created",
    resourceType: "assessment",
    resourceId: a.id,
    metadata: { questions: picked.ids.length, per_topic: picked.perTopic, assign_to: v.assign_to },
  });
  return a.id as string;
}

async function ownAssessment(staff: StaffContext, id: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("assessments").select("id, institution_id, status").eq("id", id).maybeSingle();
  if (!data || data.institution_id !== staff.institution.id) throw new DomainError("not_found", "We couldn't find that test.", 404);
  return data;
}

export async function setAssessmentStatus(staff: StaffContext, id: string, status: "active" | "completed") {
  const a = await ownAssessment(staff, id);
  const admin = createSupabaseAdminClient();
  const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (status === "active" && a.status === "draft") patch.start_at = new Date().toISOString();
  await admin.from("assessments").update(patch).eq("id", id);
  await audit({ actorUserId: staff.userId, institutionId: staff.institution.id, action: status === "active" ? "assessment.published" : "assessment.closed", resourceType: "assessment", resourceId: id });
}
