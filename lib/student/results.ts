import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { StudentContext } from "@/lib/auth/session";
import { nextStep } from "@/lib/scoring/next-step";
import { jambBreakdowns } from "@/lib/assessments/jamb-results";

export async function loadStudentResult(ctx: StudentContext, attemptId: string) {
  const supabase = await createSupabaseServerClient();
  // RLS: a student can only read their own attempts
  const { data: at } = await supabase
    .from("assessment_attempts")
    .select("id, assessment_id, student_id, status, score, max_score, percentage, correct_count, incorrect_count, unanswered_count, time_used_seconds, submitted_at, synced_late, assessment:assessments(name, duration_seconds, format, subject:subjects(name))")
    .eq("id", attemptId)
    .maybeSingle();
  if (!at || at.student_id !== ctx.student.id) return null;
  const { data: tp } = await supabase
    .from("topic_performance")
    .select("topic_id, questions_total, questions_attempted, correct_answers, percentage, topic:topics(name, subject:subjects(name))")
    .eq("attempt_id", attemptId);
  type TP = { topic_id: string; questions_total: number; questions_attempted: number; correct_answers: number; percentage: number; topic: { name: string; subject: { name: string } | null } | null };
  const rows = (tp ?? []) as unknown as TP[];
  // A full JAMB mock covers 4 subjects: name each topic with its subject
  const manySubjects = new Set(rows.map((t) => t.topic?.subject?.name)).size > 1;
  const topics = rows
    .map((t) => ({ ...t, name: `${manySubjects && t.topic?.subject ? `${t.topic.subject.name} · ` : ""}${t.topic?.name ?? "Topic"}`, percentage: Number(t.percentage) }))
    .sort((a, b) => a.percentage - b.percentage);
  const step =
    at.status === "in_progress"
      ? null
      : nextStep({
          topics: topics.map((t) => ({ topic_id: t.topic_id, name: t.name, percentage: t.percentage, questions_total: t.questions_total })),
          unansweredCount: at.unanswered_count ?? 0,
          totalQuestions: (at.correct_count ?? 0) + (at.incorrect_count ?? 0) + (at.unanswered_count ?? 0),
          autoSubmitted: at.status === "auto_submitted",
        });
  type A = typeof at & { assessment: { name: string; duration_seconds: number; format: string; subject: { name: string } | null } | null };
  const attempt = at as unknown as A;
  // ownership checked above
  const jamb = attempt.assessment?.format === "jamb_utme" ? (await jambBreakdowns([attempt.id])).get(attempt.id) ?? null : null;
  return { attempt, topics, step, jamb };
}

/**
 * Mistake review: the student's wrong and blank answers with the correct answer and
 * explanation. The answer key is only revealed for a CLOSED attempt that belongs to
 * this student, so it can't be used to cheat a test in progress.
 */
export async function loadMistakes(ctx: StudentContext, attemptId: string) {
  const admin = createSupabaseAdminClient();
  const { data: at } = await admin.from("assessment_attempts").select("id, student_id, status, question_order, option_order, assessment:assessments(name)").eq("id", attemptId).maybeSingle();
  if (!at || at.student_id !== ctx.student.id || at.status === "in_progress") return null;
  const ids = at.question_order as string[];
  const [{ data: qs }, { data: opts }, { data: resp }] = await Promise.all([
    admin.from("questions").select("id, question_text, explanation, topic:topics(name), subject:subjects(name)").in("id", ids),
    admin.from("question_options").select("id, question_id, option_text, is_correct").in("question_id", ids),
    admin.from("responses").select("question_id, selected_option_id, is_correct").eq("attempt_id", attemptId),
  ]);
  const labels = ["A", "B", "C", "D"];
  const order = at.option_order as Record<string, string[]>;
  const respBy = new Map((resp ?? []).map((r) => [r.question_id, r]));
  type Q = { id: string; question_text: string; explanation: string | null; topic: { name: string } | null; subject: { name: string } | null };
  const qBy = new Map(((qs ?? []) as unknown as Q[]).map((q) => [q.id, q]));
  const items = ids
    .map((qid, i) => {
      const q = qBy.get(qid);
      const r = respBy.get(qid);
      const options = (order[qid] ?? []).map((oid, j) => {
        const o = (opts ?? []).find((x) => x.id === oid);
        return { id: oid, label: labels[j], text: o?.option_text ?? "", is_correct: Boolean(o?.is_correct) };
      });
      return {
        number: i + 1,
        question_id: qid,
        text: q?.question_text ?? "",
        topic: q?.topic?.name ?? "",
        subject: q?.subject?.name ?? "",
        explanation: q?.explanation ?? null,
        options,
        selected: r?.selected_option_id ?? null,
        correct: Boolean(r?.is_correct),
      };
    })
    .filter((x) => !x.correct);
  return { name: (at.assessment as unknown as { name: string } | null)?.name ?? "", items };
}
