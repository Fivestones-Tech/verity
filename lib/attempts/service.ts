import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DomainError } from "@/lib/api";
import type { StudentContext } from "@/lib/auth/session";
import { shuffle } from "@/lib/shuffle";
import { scoreAttempt, type KeyedQuestion } from "@/lib/scoring/score";
import {
  classifyAnswer,
  computeExpiry,
  isPastGrace,
  lateWindowPassed,
  timeUsedSeconds,
} from "@/lib/attempts/timing";
import type { AnswerItem } from "@/lib/validation/attempts";
import { sittingSubjectOrder } from "@/lib/scoring/jamb";
import { JAMB_SITTING } from "@/lib/assessments/kinds";
import { decideStart, START_MESSAGES } from "@/lib/entitlements/pass";
import { loadStudentAccess } from "@/lib/entitlements/access";

/**
 * Attempt lifecycle (docs/08, docs/17). Every function here runs server-side with
 * the service role, so each one checks ownership itself before touching data.
 */

type AttemptRow = {
  id: string;
  assessment_id: string;
  student_id: string;
  attempt_number: number;
  started_at: string;
  expires_at: string;
  submitted_at: string | null;
  status: "in_progress" | "submitted" | "auto_submitted" | "abandoned";
  question_order: string[];
  option_order: Record<string, string[]>;
  synced_late: boolean;
};

type AssessmentRow = {
  id: string;
  institution_id: string | null;
  name: string;
  status: string;
  duration_seconds: number;
  attempt_limit: number;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  start_at: string | null;
  end_at: string | null;
  instructions: string | null;
  format: "single_subject" | "jamb_utme";
  subject: { name: string } | null;
};

const ATTEMPT_COLUMNS =
  "id, assessment_id, student_id, attempt_number, started_at, expires_at, submitted_at, status, question_order, option_order, synced_late";

export type AttemptPayload = {
  attempt_id: string;
  assessment_id: string;
  assessment_name: string;
  subject_name: string;
  status: AttemptRow["status"];
  started_at: string;
  expires_at: string;
  server_now: string;
  questions: {
    id: string;
    number: number;
    /** the question's subject: lets a full JAMB sitting group questions by paper */
    subject: string;
    text: string;
    options: { id: string; label: "A" | "B" | "C" | "D"; text: string }[];
  }[];
  saved: { question_id: string; selected_option_id: string | null; seq: number }[];
};

function db() {
  return createSupabaseAdminClient();
}

async function loadAssessment(assessmentId: string): Promise<AssessmentRow | null> {
  const { data } = await db()
    .from("assessments")
    .select(
      "id, institution_id, name, status, duration_seconds, attempt_limit, shuffle_questions, shuffle_options, start_at, end_at, instructions, format, subject:subjects(name)",
    )
    .eq("id", assessmentId)
    .maybeSingle();
  return (data as unknown as AssessmentRow) ?? null;
}

/** Is this student assigned this assessment? Mirrors app.my_assigned_assessment_ids(). */
export async function isAssigned(ctx: StudentContext, assessment: { id: string; institution_id: string | null }) {
  if (!assessment.institution_id || assessment.institution_id !== ctx.student.institution_id) return false;
  const { data } = await db()
    .from("assessment_assignments")
    .select("student_id, class_id")
    .eq("assessment_id", assessment.id);
  return (data ?? []).some(
    (a) =>
      (a.student_id === null && a.class_id === null) ||
      a.student_id === ctx.student.id ||
      (a.class_id !== null && a.class_id === ctx.student.class_id),
  );
}

async function loadOwnAttempt(ctx: StudentContext, attemptId: string): Promise<AttemptRow> {
  const { data } = await db().from("assessment_attempts").select(ATTEMPT_COLUMNS).eq("id", attemptId).maybeSingle();
  // Same message whether it doesn't exist or belongs to someone else: no inference.
  if (!data || data.student_id !== ctx.student.id) {
    throw new DomainError("attempt_not_found", "We couldn't find this test attempt.", 404);
  }
  return data as AttemptRow;
}

export async function startAttempt(ctx: StudentContext, assessmentId: string): Promise<AttemptPayload> {
  const assessment = await loadAssessment(assessmentId);
  if (!assessment || !(await isAssigned(ctx, assessment))) {
    throw new DomainError("assessment_not_found", "We couldn't find this test.", 404);
  }

  const { data: existing } = await db()
    .from("assessment_attempts")
    .select(ATTEMPT_COLUMNS)
    .eq("assessment_id", assessmentId)
    .eq("student_id", ctx.student.id)
    .order("attempt_number", { ascending: false });
  const attempts = (existing ?? []) as AttemptRow[];
  const now = new Date();

  const open = attempts.find((a) => a.status === "in_progress");
  if (open) {
    // Resume, even after time is up: the device may still hold answers to sync.
    if (!lateWindowPassed(now, new Date(open.expires_at))) return buildPayload(open, assessment);
    await finalizeAttempt(open, "auto_submitted", null);
  }

  const closedCount = attempts.filter((a) => a.status !== "in_progress").length + (open ? 1 : 0);
  if (closedCount >= assessment.attempt_limit) {
    throw new DomainError("attempt_limit_reached", "You have already taken this test.", 409);
  }
  if (assessment.status !== "active") {
    throw new DomainError("assessment_closed", "This test is not open right now.", 409);
  }
  if (assessment.start_at && new Date(assessment.start_at) > now) {
    throw new DomainError("assessment_not_started", "This test has not opened yet.", 409);
  }
  if (assessment.end_at && new Date(assessment.end_at) <= now) {
    throw new DomainError("assessment_closed", "This test has closed.", 409);
  }

  // Early Access pass or the one free trial test (docs/09, D27). Checked after the resume
  // path above, so a student mid-test never loses answers because of billing.
  const access = await loadStudentAccess(ctx.student.id, now);
  const decision = decideStart({ hasActivePass: Boolean(access.pass), format: assessment.format, attemptsStarted: access.attemptsStarted });
  if (!decision.allowed) throw new DomainError(decision.reason, START_MESSAGES[decision.reason], 402);

  const { data: aq } = await db()
    .from("assessment_questions")
    .select("question_id, position")
    .eq("assessment_id", assessmentId)
    .order("position");
  const poolIds = (aq ?? []).map((r) => r.question_id as string);
  if (poolIds.length === 0) {
    throw new DomainError("assessment_empty", "This test has no questions yet. Please tell your teacher.", 409);
  }
  // A full JAMB sitting holds questions for every subject; each student gets English + their 3.
  const blocks = assessment.format === "jamb_utme" ? await sittingBlocks(ctx, poolIds) : [poolIds];
  const questionIds = blocks.flat();

  const { data: opts } = await db()
    .from("question_options")
    .select("id, question_id, option_key")
    .in("question_id", questionIds)
    .order("option_key");
  const optionOrder: Record<string, string[]> = {};
  for (const qid of questionIds) {
    const ids = (opts ?? []).filter((o) => o.question_id === qid).map((o) => o.id as string);
    optionOrder[qid] = assessment.shuffle_options ? shuffle(ids) : ids;
  }

  const startedAt = now;
  const expiresAt = computeExpiry(startedAt, assessment.duration_seconds, assessment.end_at ? new Date(assessment.end_at) : null);
  const attemptNumber = (attempts[0]?.attempt_number ?? 0) + 1;

  const { data: created, error } = await db()
    .from("assessment_attempts")
    .insert({
      assessment_id: assessmentId,
      student_id: ctx.student.id,
      attempt_number: attemptNumber,
      started_at: startedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      // shuffle within each paper so a sitting keeps English first, then each subject together
      question_order: blocks.flatMap((b) => (assessment.shuffle_questions ? shuffle(b) : b)),
      option_order: optionOrder,
    })
    .select(ATTEMPT_COLUMNS)
    .single();

  if (error) {
    // Two "Begin" taps at once: the unique constraint lets only one through.
    if (error.code === "23505") {
      const { data: winner } = await db()
        .from("assessment_attempts")
        .select(ATTEMPT_COLUMNS)
        .eq("assessment_id", assessmentId)
        .eq("student_id", ctx.student.id)
        .eq("attempt_number", attemptNumber)
        .single();
      if (winner) return buildPayload(winner as AttemptRow, assessment);
    }
    console.error("[attempts] start failed", error.message);
    throw new DomainError("attempt_start_failed", "We couldn't start the test. Please try again.", 500);
  }
  if (decision.via === "trial") await keepOnlyFirstTrialAttempt(ctx, (created as AttemptRow).id);
  return buildPayload(created as AttemptRow, assessment);
}

/**
 * Two "Begin" taps on two different tests at the same moment could both pass the trial
 * check. The earliest attempt keeps the trial; a later one is removed before the student
 * sees a single question.
 */
async function keepOnlyFirstTrialAttempt(ctx: StudentContext, attemptId: string) {
  const { data } = await db()
    .from("assessment_attempts")
    .select("id")
    .eq("student_id", ctx.student.id)
    .order("started_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(1);
  if (data?.[0] && data[0].id !== attemptId) {
    await db().from("assessment_attempts").delete().eq("id", attemptId).eq("status", "in_progress");
    throw new DomainError("pass_required", START_MESSAGES.pass_required, 402);
  }
}

/** English first, then the student's 3 subjects, each as one block of the sitting's questions. */
async function sittingBlocks(ctx: StudentContext, poolIds: string[]): Promise<string[][]> {
  const [{ data: mine }, { data: qs }] = await Promise.all([
    db().from("student_subjects").select("subject_id").eq("student_id", ctx.student.id),
    db().from("questions").select("id, subject_id").in("id", poolIds),
  ]);
  const chosen = (mine ?? []).map((r) => r.subject_id as string);
  if (chosen.length !== JAMB_SITTING.subjectsPerStudent) {
    throw new DomainError("subjects_not_set", "Your JAMB subjects aren't set yet. Please ask your teacher to add them.", 409);
  }
  const { data: subs } = await db().from("subjects").select("id, name, code").or(`id.in.(${chosen.join(",")}),code.eq.${JAMB_SITTING.englishCode}`);
  const english = (subs ?? []).find((s) => s.code === JAMB_SITTING.englishCode && poolIds.length > 0 && (qs ?? []).some((q) => q.subject_id === s.id));
  const wanted = (subs ?? []).filter((s) => chosen.includes(s.id as string) || s.id === english?.id) as { id: string; name: string; code: string }[];
  const order = sittingSubjectOrder(wanted);
  const blocks = order.map((sid) => poolIds.filter((qid) => (qs ?? []).find((q) => q.id === qid)?.subject_id === sid));
  const missing = order.filter((_, i) => blocks[i].length === 0);
  if (!english || missing.length) {
    throw new DomainError("subject_not_in_sitting", "This mock doesn't include one of your subjects. Please tell your teacher.", 409);
  }
  return blocks;
}

export async function getAttemptPayload(ctx: StudentContext, attemptId: string): Promise<AttemptPayload> {
  const attempt = await loadOwnAttempt(ctx, attemptId);
  const assessment = await loadAssessment(attempt.assessment_id);
  if (!assessment) throw new DomainError("attempt_not_found", "We couldn't find this test attempt.", 404);
  return buildPayload(attempt, assessment);
}

async function buildPayload(attempt: AttemptRow, assessment: AssessmentRow): Promise<AttemptPayload> {
  const ids = attempt.question_order;
  const [{ data: qs }, { data: opts }, { data: saved }] = await Promise.all([
    db().from("questions").select("id, question_text, subject:subjects(name)").in("id", ids),
    // NOTE: is_correct is deliberately not selected. The answer key never leaves the server.
    db().from("question_options").select("id, question_id, option_text").in("question_id", ids),
    db().from("responses").select("question_id, selected_option_id, seq").eq("attempt_id", attempt.id),
  ]);
  const qById = new Map((qs ?? []).map((q) => [q.id as string, q.question_text as string]));
  const subjectById = new Map((qs ?? []).map((q) => [q.id as string, (q.subject as unknown as { name: string } | null)?.name ?? ""]));
  const oById = new Map((opts ?? []).map((o) => [o.id as string, o.option_text as string]));
  const labels = ["A", "B", "C", "D"] as const;

  return {
    attempt_id: attempt.id,
    assessment_id: assessment.id,
    assessment_name: assessment.name,
    subject_name: assessment.subject?.name ?? "",
    status: attempt.status,
    started_at: attempt.started_at,
    expires_at: attempt.expires_at,
    server_now: new Date().toISOString(),
    questions: ids.map((qid, i) => ({
      id: qid,
      number: i + 1,
      subject: subjectById.get(qid) ?? "",
      text: qById.get(qid) ?? "",
      options: (attempt.option_order[qid] ?? []).map((oid, j) => ({
        id: oid,
        label: labels[j],
        text: oById.get(oid) ?? "",
      })),
    })),
    saved: (saved ?? []).map((s) => ({
      question_id: s.question_id as string,
      selected_option_id: (s.selected_option_id as string | null) ?? null,
      seq: s.seq as number,
    })),
  };
}

export type SaveResult = {
  accepted: string[]; // question ids stored (or already stored at a newer seq)
  rejected: { question_id: string; reason: string }[];
  attempt_status: AttemptRow["status"];
};

/** Validate and store answers. Idempotent: re-sending the same batch is harmless. */
async function applyAnswers(attempt: AttemptRow, answers: AnswerItem[], now: Date): Promise<SaveResult> {
  const result: SaveResult = { accepted: [], rejected: [], attempt_status: attempt.status };
  if (answers.length === 0) return result;

  const inAttempt = new Set(attempt.question_order);
  const expiresAt = new Date(attempt.expires_at);
  const valid: AnswerItem[] = [];
  let late = false;

  // keep only the highest seq per question within this batch
  const latest = new Map<string, AnswerItem>();
  for (const a of answers) {
    const prev = latest.get(a.question_id);
    if (!prev || a.seq > prev.seq) latest.set(a.question_id, a);
  }

  for (const a of latest.values()) {
    if (!inAttempt.has(a.question_id)) {
      result.rejected.push({ question_id: a.question_id, reason: "not_in_attempt" });
      continue;
    }
    if (a.selected_option_id && !(attempt.option_order[a.question_id] ?? []).includes(a.selected_option_id)) {
      result.rejected.push({ question_id: a.question_id, reason: "invalid_option" });
      continue;
    }
    const timing = classifyAnswer(now, expiresAt, new Date(a.answered_at));
    if (timing === "rejected_after_expiry" || timing === "window_closed") {
      result.rejected.push({ question_id: a.question_id, reason: "after_time_limit" });
      continue;
    }
    if (timing === "late_sync") late = true;
    valid.push(a);
  }

  if (valid.length) {
    const { error } = await db().rpc("save_responses", {
      p_attempt_id: attempt.id,
      p_items: valid.map((a) => ({
        question_id: a.question_id,
        selected_option_id: a.selected_option_id ?? "",
        seq: a.seq,
        answered_at: a.answered_at,
        time_spent_seconds: a.time_spent_seconds ?? "",
      })),
    });
    if (error) {
      console.error("[attempts] save_responses failed", error.message);
      throw new DomainError("save_failed", "We couldn't save your answers yet. They are still on your device.", 500);
    }
    result.accepted.push(...valid.map((a) => a.question_id));
    if (late && !attempt.synced_late) {
      await db().from("assessment_attempts").update({ synced_late: true }).eq("id", attempt.id);
    }
  }
  return result;
}

export async function saveAnswers(ctx: StudentContext, attemptId: string, answers: AnswerItem[]): Promise<SaveResult> {
  const attempt = await loadOwnAttempt(ctx, attemptId);
  if (attempt.status !== "in_progress") {
    throw new DomainError("attempt_closed", "This test has already been submitted.", 409);
  }
  return applyAnswers(attempt, answers, new Date());
}

export type AttemptResultSummary = {
  attempt_id: string;
  status: AttemptRow["status"];
  already_submitted: boolean;
};

/**
 * Submit an attempt. Idempotent (docs/17): if the attempt is already closed, the
 * existing result stands and nothing is re-scored.
 */
export async function submitAttempt(
  ctx: StudentContext,
  attemptId: string,
  input: { submission_key: string; answers: AnswerItem[]; reason: "student" | "timer" },
): Promise<AttemptResultSummary & { rejected: SaveResult["rejected"] }> {
  const attempt = await loadOwnAttempt(ctx, attemptId);
  if (attempt.status !== "in_progress") {
    return { attempt_id: attempt.id, status: attempt.status, already_submitted: true, rejected: [] };
  }
  const now = new Date();
  const saved = await applyAnswers(attempt, input.answers, now);
  const status = input.reason === "timer" || isPastGrace(now, new Date(attempt.expires_at)) ? "auto_submitted" : "submitted";
  const closedNow = await finalizeAttempt(attempt, status, input.submission_key, now);
  const final = closedNow ? status : (await loadOwnAttempt(ctx, attemptId)).status;
  return { attempt_id: attempt.id, status: final, already_submitted: !closedNow, rejected: saved.rejected };
}

/** Score server-side and close the attempt atomically. Returns false if it was already closed. */
export async function finalizeAttempt(
  attempt: AttemptRow,
  status: "submitted" | "auto_submitted",
  submissionKey: string | null,
  now = new Date(),
): Promise<boolean> {
  const ids = attempt.question_order;
  const [{ data: aq }, { data: qs }, { data: opts }, { data: resp }] = await Promise.all([
    db().from("assessment_questions").select("question_id, points").eq("assessment_id", attempt.assessment_id),
    db().from("questions").select("id, topic_id").in("id", ids),
    db().from("question_options").select("id, question_id, is_correct").in("question_id", ids),
    db().from("responses").select("question_id, selected_option_id").eq("attempt_id", attempt.id),
  ]);
  const points = new Map((aq ?? []).map((r) => [r.question_id as string, Number(r.points)]));
  // Results are reported per main topic: a subtopic's questions count toward its parent,
  // so a 20-question test gives a few meaningful topic scores rather than many tiny ones.
  const topicIds = [...new Set((qs ?? []).map((q) => q.topic_id as string))];
  const { data: topicRows } = await db().from("topics").select("id, parent_topic_id").in("id", topicIds);
  const parentOf = new Map((topicRows ?? []).map((t) => [t.id as string, (t.parent_topic_id as string | null) ?? (t.id as string)]));
  const topicOf = new Map((qs ?? []).map((q) => [q.id as string, parentOf.get(q.topic_id as string) ?? (q.topic_id as string)]));

  const key: KeyedQuestion[] = ids.map((qid) => {
    const qOpts = (opts ?? []).filter((o) => o.question_id === qid);
    const correct = qOpts.find((o) => o.is_correct);
    return {
      question_id: qid,
      topic_id: topicOf.get(qid) ?? "",
      points: points.get(qid) ?? 1,
      correct_option_id: (correct?.id as string) ?? "",
      option_ids: qOpts.map((o) => o.id as string),
    };
  });
  const selections = new Map((resp ?? []).map((r) => [r.question_id as string, (r.selected_option_id as string | null) ?? null]));
  const result = scoreAttempt(key, selections);
  const submittedAt = now;

  const { data: closed, error } = await db().rpc("finalize_attempt", {
    p_attempt_id: attempt.id,
    p_status: status,
    p_submitted_at: submittedAt.toISOString(),
    p_submission_key: submissionKey,
    p_score: result.score,
    p_max_score: result.max_score,
    p_percentage: result.percentage,
    p_correct: result.correct_count,
    p_incorrect: result.incorrect_count,
    p_unanswered: result.unanswered_count,
    p_time_used: timeUsedSeconds(new Date(attempt.started_at), submittedAt, new Date(attempt.expires_at)),
    p_questions: result.questions,
    p_topics: result.topics,
  });
  if (error) {
    console.error("[attempts] finalize failed", error.message);
    throw new DomainError("submit_failed", "We couldn't submit your test yet. Your answers are saved. Please try again.", 500);
  }
  return closed === true;
}

/**
 * Close attempts whose late-sync window has passed (student never came back online).
 * Called when a teacher opens results and when a student opens their dashboard.
 */
export async function closeStaleAttempts(filter: { assessmentId?: string; studentId?: string }) {
  let q = db().from("assessment_attempts").select(ATTEMPT_COLUMNS).eq("status", "in_progress");
  if (filter.assessmentId) q = q.eq("assessment_id", filter.assessmentId);
  if (filter.studentId) q = q.eq("student_id", filter.studentId);
  const { data } = await q;
  const now = new Date();
  for (const a of (data ?? []) as AttemptRow[]) {
    if (lateWindowPassed(now, new Date(a.expires_at))) await finalizeAttempt(a, "auto_submitted", null, now);
  }
}
