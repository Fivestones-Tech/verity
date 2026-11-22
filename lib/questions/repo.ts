import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normaliseText, type RefSubject, type RefTopic } from "@/lib/questions/import-validation";

export function allowedExamCodes(examFocus: string): ("JAMB" | "WAEC")[] {
  if (examFocus === "jamb_only") return ["JAMB"];
  if (examFocus === "waec_only") return ["WAEC"];
  return ["JAMB", "WAEC"];
}

export async function loadSubjects(examFocus: string): Promise<RefSubject[]> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("subjects")
    .select("id, name, code, examination_id, status, exam:examinations(code)")
    .eq("status", "active")
    .order("name");
  const codes = allowedExamCodes(examFocus);
  return ((data ?? []) as unknown as (RefSubject & { exam: { code: string } })[])
    .map((s) => ({ id: s.id, name: s.name, code: s.code, examination_id: s.examination_id, exam_code: s.exam.code }))
    .filter((s) => codes.includes(s.exam_code as "JAMB" | "WAEC"));
}

/** Platform topics plus this institution's own topics. Never another centre's. */
export async function loadTopics(institutionId: string, subjectIds: string[]): Promise<RefTopic[]> {
  if (subjectIds.length === 0) return [];
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("topics")
    .select("id, subject_id, parent_topic_id, name")
    .in("subject_id", subjectIds)
    .or(`institution_id.is.null,institution_id.eq.${institutionId}`)
    .neq("status", "inactive")
    .order("name");
  return (data ?? []) as RefTopic[];
}

/** Keys of questions already in this institution's bank, for duplicate detection. */
export async function existingQuestionKeys(institutionId: string): Promise<Set<string>> {
  const admin = createSupabaseAdminClient();
  const keys = new Set<string>();
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data } = await admin
      .from("questions")
      .select("subject_id, question_text")
      .eq("institution_id", institutionId)
      .neq("status", "archived")
      .range(from, from + page - 1);
    for (const q of data ?? []) keys.add(`${q.subject_id}|${normaliseText(q.question_text)}`);
    if (!data || data.length < page) break;
  }
  return keys;
}
