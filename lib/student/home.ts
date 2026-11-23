import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { closeStaleAttempts } from "@/lib/attempts/service";
import type { StudentContext } from "@/lib/auth/session";

/** The student's assigned tests and attempts, read through RLS. */
export async function loadStudentHome(ctx: StudentContext) {
  await closeStaleAttempts({ studentId: ctx.student.id });
  const supabase = await createSupabaseServerClient();
  const [{ data: tests }, { data: attempts }] = await Promise.all([
    supabase
      .from("assessments")
      .select("id, name, assessment_type, format, status, duration_seconds, end_at, instructions, subject:subjects(name), question_count")
      .in("status", ["active", "completed"])
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("assessment_attempts")
      .select("id, assessment_id, status, percentage, score, max_score, submitted_at, expires_at")
      .eq("student_id", ctx.student.id)
      .order("started_at", { ascending: false }),
  ]);
  type T = { id: string; name: string; assessment_type: string; format: string; status: string; duration_seconds: number; end_at: string | null; instructions: string | null; subject: { name: string } | null; question_count: number };
  const byAssessment = new Map<string, NonNullable<typeof attempts>[number]>();
  for (const a of attempts ?? []) if (!byAssessment.has(a.assessment_id)) byAssessment.set(a.assessment_id, a);
  return ((tests ?? []) as unknown as T[]).map((t) => ({ ...t, questionCount: t.question_count, attempt: byAssessment.get(t.id) ?? null }));
}
