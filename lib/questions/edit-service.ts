import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import type { StaffContext } from "@/lib/auth/session";
import { DomainError } from "@/lib/api";
import type { QuestionForm } from "@/lib/validation/question";
import { loadSubjects } from "@/lib/questions/repo";

/** Load a question only if it belongs to the caller's institution. */
async function ownQuestion(staff: StaffContext, id: string) {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("questions")
    .select("id, institution_id, status, created_by, version, subject_id, topic_id")
    .eq("id", id)
    .maybeSingle();
  if (!data || data.institution_id !== staff.institution.id) {
    throw new DomainError("question_not_found", "We couldn't find that question.", 404);
  }
  return data;
}

async function resolveTopic(staff: StaffContext, v: QuestionForm): Promise<string> {
  const admin = createSupabaseAdminClient();
  if (v.topic_id) {
    const { data } = await admin.from("topics").select("id, subject_id, institution_id").eq("id", v.topic_id).maybeSingle();
    if (!data || data.subject_id !== v.subject_id || (data.institution_id && data.institution_id !== staff.institution.id)) {
      throw new DomainError("invalid_topic", "That topic doesn't belong to the chosen subject.");
    }
    return data.id;
  }
  const name = (v.new_topic ?? "").trim();
  const { data: existing } = await admin
    .from("topics")
    .select("id, name, institution_id")
    .eq("subject_id", v.subject_id)
    .is("parent_topic_id", null)
    .or(`institution_id.is.null,institution_id.eq.${staff.institution.id}`);
  const match = (existing ?? []).find((t) => t.name.toLowerCase() === name.toLowerCase());
  if (match) return match.id;
  const { data, error } = await admin
    .from("topics")
    .insert({ subject_id: v.subject_id, name, institution_id: staff.institution.id, created_by: staff.userId })
    .select("id")
    .single();
  if (error || !data) throw new DomainError("topic_failed", "We couldn't add that topic. Please try again.", 500);
  return data.id;
}

export async function saveQuestion(staff: StaffContext, v: QuestionForm, questionId: string | null) {
  const subjects = await loadSubjects(staff.institution.exam_focus);
  const subject = subjects.find((s) => s.id === v.subject_id);
  if (!subject) throw new DomainError("invalid_subject", "Choose one of your centre's subjects.");
  const topicId = await resolveTopic(staff, v);
  const admin = createSupabaseAdminClient();

  const fields = {
    subject_id: subject.id,
    examination_id: subject.examination_id,
    topic_id: topicId,
    question_text: v.question_text,
    difficulty: v.difficulty,
    explanation: v.explanation || null,
    source: v.source,
  };
  const opts = (["A", "B", "C", "D"] as const).map((k) => ({
    option_key: k,
    option_text: v[`option_${k.toLowerCase()}` as "option_a"],
    is_correct: v.correct_option === k,
  }));

  if (!questionId) {
    const { data, error } = await admin
      .from("questions")
      .insert({ ...fields, institution_id: staff.institution.id, status: "review", created_by: staff.userId })
      .select("id")
      .single();
    if (error || !data) throw new DomainError("save_failed", "We couldn't save the question. Please try again.", 500);
    const { error: oErr } = await admin.from("question_options").insert(opts.map((o) => ({ ...o, question_id: data.id })));
    if (oErr) {
      await admin.from("questions").delete().eq("id", data.id);
      throw new DomainError("save_failed", "We couldn't save the question. Please try again.", 500);
    }
    await audit({ actorUserId: staff.userId, institutionId: staff.institution.id, action: "question.created", resourceType: "question", resourceId: data.id });
    return data.id as string;
  }

  const q = await ownQuestion(staff, questionId);
  if (q.status === "archived") throw new DomainError("question_archived", "This question is archived and can't be edited.");
  const { data: before } = await admin.from("question_options").select("option_key, is_correct").eq("question_id", q.id);
  const oldKey = (before ?? []).find((o) => o.is_correct)?.option_key ?? null;

  // Any edit sends the question back for review by someone else. The editor becomes
  // its author for review purposes, so they cannot approve their own change.
  const { error } = await admin
    .from("questions")
    .update({ ...fields, status: "review", review_note: null, reviewed_by: null, reviewed_at: null, created_by: staff.userId, version: q.version + 1, updated_at: new Date().toISOString() })
    .eq("id", q.id);
  if (error) throw new DomainError("save_failed", "We couldn't save the question. Please try again.", 500);
  // options: clear the correct flag first so the one-correct index never trips
  await admin.from("question_options").update({ is_correct: false }).eq("question_id", q.id);
  for (const o of opts) {
    await admin.from("question_options").update({ option_text: o.option_text, is_correct: o.is_correct }).eq("question_id", q.id).eq("option_key", o.option_key);
  }
  await audit({
    actorUserId: staff.userId,
    institutionId: staff.institution.id,
    action: oldKey !== v.correct_option ? "question.answer_key_changed" : "question.edited",
    resourceType: "question",
    resourceId: q.id,
    metadata: { version: q.version + 1, old_key: oldKey, new_key: v.correct_option, previous_status: q.status },
  });
  return q.id as string;
}

export async function reviewQuestion(staff: StaffContext, questionId: string, decision: "approve" | "send_back", note?: string) {
  const q = await ownQuestion(staff, questionId);
  if (q.status !== "review") throw new DomainError("not_in_review", "This question is no longer waiting for review.", 409);
  if (q.created_by === staff.userId) {
    throw new DomainError("self_review", "You wrote this question, so another teacher needs to review it.", 403);
  }
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const update =
    decision === "approve"
      ? { status: "published", reviewed_by: staff.userId, reviewed_at: now, review_note: null, updated_at: now }
      : { status: "draft", reviewed_by: staff.userId, reviewed_at: now, review_note: note || "Please check this question.", updated_at: now };
  const { error } = await admin.from("questions").update(update).eq("id", q.id).eq("status", "review");
  if (error) throw new DomainError("review_failed", "We couldn't save your review. Please try again.", 500);
  await audit({
    actorUserId: staff.userId,
    institutionId: staff.institution.id,
    action: decision === "approve" ? "question.published" : "question.sent_back",
    resourceType: "question",
    resourceId: q.id,
    metadata: note ? { note } : undefined,
  });
}

export async function archiveQuestion(staff: StaffContext, questionId: string) {
  const q = await ownQuestion(staff, questionId);
  const admin = createSupabaseAdminClient();
  await admin.from("questions").update({ status: "archived", updated_at: new Date().toISOString() }).eq("id", q.id);
  await audit({ actorUserId: staff.userId, institutionId: staff.institution.id, action: "question.archived", resourceType: "question", resourceId: q.id });
}
