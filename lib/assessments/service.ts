import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import type { StaffContext } from "@/lib/auth/session";
import { DomainError } from "@/lib/api";
import { loadSubjects } from "@/lib/questions/repo";
import { pickQuestions, type PoolQuestion } from "@/lib/assessments/pick";
import type { z } from "zod";
import type { createAssessmentSchema, createSittingSchema } from "@/lib/validation/assessment";
import { JAMB_SITTING } from "@/lib/assessments/kinds";

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

/** Top-level topics of a subject this centre can use (platform + its own). */
async function topLevelTopicIds(staff: StaffContext, subjectId: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("topics")
    .select("id")
    .eq("subject_id", subjectId)
    .is("parent_topic_id", null)
    .or(`institution_id.is.null,institution_id.eq.${staff.institution.id}`);
  return (data ?? []).map((t) => t.id as string);
}

/** Creates a topic test, or a one-subject mock drawn from the whole syllabus. */
export async function createAssessment(staff: StaffContext, v: Input) {
  const subjects = await loadSubjects(staff.institution.exam_focus);
  const subject = subjects.find((s) => s.id === v.subject_id);
  if (!subject) throw new DomainError("invalid_subject", "Choose one of your centre's subjects.");
  const isMock = v.kind === "mock";
  // never trust topic ids from the form for a mock: the server decides the syllabus
  const topicIds = isMock ? await topLevelTopicIds(staff, subject.id) : v.topic_ids;
  if (topicIds.length === 0) throw new DomainError("no_topics", "This subject has no topics yet. Import questions first.");
  const groupOf = await expandTopics(staff, subject.id, topicIds);

  const pool = (await questionPool(staff, subject.id))
    .filter((q) => groupOf.has(q.topic_id))
    .map((q) => ({ ...q, topic_id: groupOf.get(q.topic_id)! }));
  const picked = pickQuestions(pool, { topicIds, count: v.question_count, difficulties: v.difficulties });
  if (picked.shortBy > 0) {
    throw new DomainError(
      "not_enough_questions",
      isMock
        ? `There are only ${picked.ids.length} published ${subject.name} questions${v.difficulties.length ? " at this difficulty" : ""}. Choose ${picked.ids.length} or fewer questions, or publish more questions.`
        : `There are only ${picked.ids.length} published questions for these topics${v.difficulties.length ? " and difficulty" : ""}. Choose ${picked.ids.length} or fewer questions, add topics, or publish more questions.`,
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
      assessment_type: isMock ? "mock" : "topic_test",
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
    metadata: { kind: v.kind, questions: picked.ids.length, per_topic: picked.perTopic, assign_to: v.assign_to },
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

type SittingInput = z.infer<typeof createSittingSchema>;

/** Students the assignment covers: everyone, or the chosen classes (already checked to be this centre's). */
async function assignedStudentIds(staff: StaffContext, assignTo: string[]) {
  const admin = createSupabaseAdminClient();
  let q = admin.from("students").select("id").eq("institution_id", staff.institution.id).eq("status", "active");
  if (!assignTo.includes("all")) q = q.in("class_id", assignTo);
  const { data } = await q;
  return (data ?? []).map((s) => s.id as string);
}

/** What a full sitting needs, for the builder and for creating it. */
export async function sittingPlan(staff: StaffContext, assignTo: string[]) {
  const subjects = (await loadSubjects(staff.institution.exam_focus)).filter((s) => s.exam_code === "JAMB");
  const english = subjects.find((s) => s.code === JAMB_SITTING.englishCode);
  const studentIds = await assignedStudentIds(staff, assignTo);
  const admin = createSupabaseAdminClient();
  const { data: ss } = studentIds.length
    ? await admin.from("student_subjects").select("student_id, subject_id").in("student_id", studentIds)
    : { data: [] };
  const per = new Map<string, number>();
  for (const r of ss ?? []) per.set(r.student_id, (per.get(r.student_id) ?? 0) + 1);
  const ready = studentIds.filter((id) => per.get(id) === JAMB_SITTING.subjectsPerStudent);
  const readySet = new Set(ready);
  const takers = new Map<string, number>();
  for (const r of ss ?? []) if (readySet.has(r.student_id)) takers.set(r.subject_id, (takers.get(r.subject_id) ?? 0) + 1);
  const needed = english && ready.length ? [english, ...subjects.filter((s) => takers.has(s.id))] : [];
  return {
    subjects,
    english,
    students: studentIds.length,
    ready: ready.length,
    readyIds: ready,
    needed: needed.map((s) => ({ ...s, takers: s.id === english?.id ? ready.length : takers.get(s.id) ?? 0 })),
  };
}

/** How many of these students have all 3 of their subjects in the sitting. */
async function coveredStudents(studentIds: string[], subjectIds: Set<string>) {
  if (studentIds.length === 0) return 0;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("student_subjects").select("student_id, subject_id").in("student_id", studentIds);
  const missing = new Set((data ?? []).filter((r) => !subjectIds.has(r.subject_id)).map((r) => r.student_id));
  return studentIds.filter((id) => !missing.has(id)).length;
}

/** Creates a full JAMB sitting: a pool of English + every subject the assigned students take. */
export async function createJambSitting(staff: StaffContext, v: SittingInput) {
  if (staff.institution.exam_focus === "waec_only") {
    throw new DomainError("not_jamb", "Full JAMB sittings are for centres preparing students for JAMB.");
  }
  const admin = createSupabaseAdminClient();
  const classIds = v.assign_to.filter((a) => a !== "all");
  if (classIds.length) {
    const { data: cls } = await admin.from("classes").select("id").eq("institution_id", staff.institution.id).in("id", classIds);
    if ((cls ?? []).length !== classIds.length) throw new DomainError("invalid_class", "Choose classes from your centre.");
  }
  const plan = await sittingPlan(staff, v.assign_to.includes("all") ? ["all"] : classIds);
  if (!plan.english) throw new DomainError("no_english", "English isn't set up for JAMB yet.");
  if (plan.ready === 0) {
    throw new DomainError("no_subjects", "None of these students have their 3 JAMB subjects set. Add them on the Students page first.");
  }

  // A subject without enough questions is left out: students who take it can't sit this
  // mock (they're told to ask their teacher), but everyone else can. English is required.
  const picked: string[] = [];
  const short: string[] = [];
  const included: string[] = [];
  for (const s of plan.needed) {
    const isEnglish = s.id === plan.english.id;
    const want = isEnglish ? v.english_questions : v.other_questions;
    const topicIds = await topLevelTopicIds(staff, s.id);
    const groupOf = topicIds.length ? await expandTopics(staff, s.id, topicIds) : new Map<string, string>();
    const pool = (await questionPool(staff, s.id)).filter((q) => groupOf.has(q.topic_id)).map((q) => ({ ...q, topic_id: groupOf.get(q.topic_id)! }));
    const r = pickQuestions(pool, { topicIds, count: want });
    if (r.shortBy > 0) {
      if (isEnglish) {
        throw new DomainError("not_enough_questions", `There are only ${r.ids.length} published English questions. Publish more, or lower the number of English questions.`);
      }
      short.push(s.name);
      continue;
    }
    included.push(s.id);
    picked.push(...r.ids);
  }
  const covered = await coveredStudents(plan.readyIds, new Set(included));
  if (covered === 0) {
    throw new DomainError(
      "not_enough_questions",
      `No student can sit this mock yet: not enough published questions for ${short.join(", ")}. Publish more questions, or lower the number of questions per subject.`,
    );
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
      examination_id: plan.english.examination_id,
      subject_id: null,
      format: "jamb_utme",
      name: v.name,
      assessment_type: "mock",
      duration_seconds: v.duration_minutes * 60,
      // what each student answers: English + 3 subjects
      question_count: v.english_questions + JAMB_SITTING.subjectsPerStudent * v.other_questions,
      attempt_limit: 1,
      status: v.open_now ? "active" : "draft",
      instructions: v.instructions || null,
      start_at: v.open_now ? new Date().toISOString() : null,
      end_at: endAt?.toISOString() ?? null,
    })
    .select("id")
    .single();
  if (error || !a) {
    console.error("[assessments] sitting insert failed", error?.message);
    throw new DomainError("create_failed", "We couldn't create the mock. Please try again.", 500);
  }
  const { error: qErr } = await admin
    .from("assessment_questions")
    .insert(picked.map((qid, i) => ({ assessment_id: a.id, question_id: qid, position: i + 1 })));
  const assignments = v.assign_to.includes("all")
    ? [{ assessment_id: a.id, assigned_by: staff.userId }]
    : classIds.map((c) => ({ assessment_id: a.id, class_id: c, assigned_by: staff.userId }));
  const { error: asErr } = await admin.from("assessment_assignments").insert(assignments);
  if (qErr || asErr) {
    console.error("[assessments] sitting children insert failed", qErr?.message, asErr?.message);
    await admin.from("assessments").delete().eq("id", a.id);
    throw new DomainError("create_failed", "We couldn't create the mock. Please try again.", 500);
  }
  await audit({
    actorUserId: staff.userId,
    institutionId: staff.institution.id,
    action: v.open_now ? "assessment.published" : "assessment.created",
    resourceType: "assessment",
    resourceId: a.id,
    metadata: { kind: "jamb_utme", pool: picked.length, subjects: plan.needed.filter((s) => included.includes(s.id)).map((s) => s.code), left_out: short, students_covered: covered, students: plan.students },
  });
  return a.id as string;
}
