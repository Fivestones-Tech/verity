import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FullQuestion = {
  id: string;
  question_text: string;
  difficulty: string;
  explanation: string | null;
  source: string;
  status: string;
  review_note: string | null;
  created_by: string | null;
  version: number;
  subject_id: string;
  topic_id: string;
  subject: { name: string } | null;
  topic: { name: string } | null;
  author: { full_name: string } | null;
  options: { option_key: "A" | "B" | "C" | "D"; option_text: string; is_correct: boolean }[];
};

/** Read through RLS: returns null for anything outside the caller's centre. */
export async function loadQuestion(id: string): Promise<FullQuestion | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("questions")
    .select(
      "id, question_text, difficulty, explanation, source, status, review_note, created_by, version, subject_id, topic_id, subject:subjects(name), topic:topics(name), author:profiles!questions_created_by_fkey(full_name), options:question_options(option_key, option_text, is_correct)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const q = data as unknown as FullQuestion;
  q.options.sort((a, b) => a.option_key.localeCompare(b.option_key));
  return q;
}
