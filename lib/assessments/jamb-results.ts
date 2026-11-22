import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { jambScores, sittingSubjectOrder } from "@/lib/scoring/jamb";

export type JambBreakdown = { subjects: { subject_id: string; name: string; correct: number; total: number; score: number }[]; total: number; max: number };

/**
 * JAMB-style subject scores (each /100, total /400) for closed attempts of a full sitting.
 * Uses the service role: callers must already have checked the viewer may see these attempts.
 */
export async function jambBreakdowns(attemptIds: string[]): Promise<Map<string, JambBreakdown>> {
  const out = new Map<string, JambBreakdown>();
  if (attemptIds.length === 0) return out;
  const admin = createSupabaseAdminClient();
  const { data: attempts } = await admin.from("assessment_attempts").select("id, status, question_order").in("id", attemptIds);
  const closed = (attempts ?? []).filter((a) => a.status !== "in_progress");
  if (closed.length === 0) return out;
  const allQ = [...new Set(closed.flatMap((a) => a.question_order as string[]))];
  const [{ data: qs }, { data: resp }] = await Promise.all([
    admin.from("questions").select("id, subject_id").in("id", allQ),
    admin.from("responses").select("attempt_id, question_id, is_correct").in("attempt_id", closed.map((a) => a.id)),
  ]);
  const subjectOf = new Map((qs ?? []).map((q) => [q.id as string, q.subject_id as string]));
  const { data: subs } = await admin.from("subjects").select("id, name, code").in("id", [...new Set(subjectOf.values())]);
  const subjectBy = new Map((subs ?? []).map((s) => [s.id as string, s as { id: string; name: string; code: string }]));
  const correct = new Set((resp ?? []).filter((r) => r.is_correct).map((r) => `${r.attempt_id}:${r.question_id}`));
  for (const a of closed) {
    const ids = a.question_order as string[];
    const used = [...new Set(ids.map((q) => subjectOf.get(q)!).filter(Boolean))].map((id) => subjectBy.get(id)!).filter(Boolean);
    const r = jambScores(
      ids.map((q) => ({ subject_id: subjectOf.get(q) ?? "", is_correct: correct.has(`${a.id}:${q}`) })),
      sittingSubjectOrder(used),
    );
    out.set(a.id, { ...r, subjects: r.subjects.map((s) => ({ ...s, name: subjectBy.get(s.subject_id)?.name ?? "Subject" })) });
  }
  return out;
}
