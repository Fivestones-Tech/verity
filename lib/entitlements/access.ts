import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { activePass, type PassRow } from "@/lib/entitlements/pass";

export type StudentAccess = {
  pass: (PassRow & { id: string; plan_key: string; source: string }) | null;
  attemptsStarted: number;
};

/** Facts for decideStart() and the student's pass card. Service role, filtered by the verified student id. */
export async function loadStudentAccess(studentId: string, now: Date = new Date()): Promise<StudentAccess> {
  const admin = createSupabaseAdminClient();
  const [{ data: passes }, { count }] = await Promise.all([
    admin.from("student_passes").select("id, plan_key, source, status, starts_at, ends_at").eq("student_id", studentId),
    admin.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("student_id", studentId),
  ]);
  return { pass: activePass(passes ?? [], now), attemptsStarted: count ?? 0 };
}

/** Pass status for many students at once (staff and admin lists). */
export async function activePassesFor(studentIds: string[], now: Date = new Date()) {
  const out = new Map<string, { ends_at: string; source: string }>();
  if (studentIds.length === 0) return out;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("student_passes")
    .select("student_id, status, starts_at, ends_at, source")
    .in("student_id", studentIds);
  const byStudent = new Map<string, NonNullable<typeof data>>();
  for (const p of data ?? []) byStudent.set(p.student_id, [...(byStudent.get(p.student_id) ?? []), p]);
  for (const [id, rows] of byStudent) {
    const a = activePass(rows, now);
    if (a) out.set(id, { ends_at: a.ends_at, source: a.source });
  }
  return out;
}
