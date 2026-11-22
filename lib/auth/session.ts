import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { hasAnyRole, type StaffRole } from "@/lib/auth/roles";

export class AuthError extends Error {
  constructor(
    public code: "unauthenticated" | "forbidden",
    message: string,
  ) {
    super(message);
  }
}

export type StaffContext = {
  userId: string;
  fullName: string;
  institution: { id: string; name: string; code: string; type: string; exam_focus: string };
  roles: StaffRole[];
};

export type StudentContext = {
  userId: string;
  student: { id: string; full_name: string; institution_id: string | null; class_id: string | null };
};

/** Verified user id from the auth server (never from a cookie value alone). */
export async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

async function loadStaff(userId: string): Promise<StaffContext | null> {
  // Service client is safe here: we filter strictly by the verified user id.
  const admin = createSupabaseAdminClient();
  const { data: rows } = await admin
    .from("institution_memberships")
    .select("role, institution:institutions(id, name, code, type, exam_focus, status)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (!rows || rows.length === 0) return null;
  type Row = { role: StaffRole; institution: StaffContext["institution"] & { status: string } };
  const typed = rows as unknown as Row[];
  const usable = typed.filter((r) => r.institution && !["suspended", "cancelled"].includes(r.institution.status));
  if (usable.length === 0) return null;
  // Pilot: a staff member belongs to one centre. If several, use the first by name.
  usable.sort((a, b) => a.institution.name.localeCompare(b.institution.name));
  const inst = usable[0].institution;
  const roles = usable.filter((r) => r.institution.id === inst.id).map((r) => r.role);
  const { data: profile } = await admin.from("profiles").select("full_name").eq("id", userId).single();
  return {
    userId,
    fullName: profile?.full_name ?? "",
    institution: { id: inst.id, name: inst.name, code: inst.code, type: inst.type, exam_focus: inst.exam_focus },
    roles,
  };
}

async function loadStudent(userId: string): Promise<StudentContext | null> {
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("students")
    .select("id, full_name, institution_id, class_id, status")
    .eq("profile_id", userId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  return { userId, student: data };
}

/** For server actions / route handlers: throws AuthError instead of redirecting. */
export async function authorizeStaff(allowed?: StaffRole[]): Promise<StaffContext> {
  const userId = await getUserId();
  if (!userId) throw new AuthError("unauthenticated", "Please sign in again.");
  const ctx = await loadStaff(userId);
  if (!ctx) throw new AuthError("forbidden", "You don't have access to this.");
  if (allowed && !hasAnyRole(ctx.roles, allowed)) {
    throw new AuthError("forbidden", "Your role can't do this. Ask your centre admin.");
  }
  return ctx;
}

export async function authorizeStudent(): Promise<StudentContext> {
  const userId = await getUserId();
  if (!userId) throw new AuthError("unauthenticated", "Please sign in again.");
  const ctx = await loadStudent(userId);
  if (!ctx) throw new AuthError("forbidden", "This account is not a student account.");
  return ctx;
}

/** For pages: redirects instead of throwing. */
export async function requireStaffPage(allowed?: StaffRole[]): Promise<StaffContext> {
  try {
    return await authorizeStaff(allowed);
  } catch (e) {
    if (e instanceof AuthError && e.code === "unauthenticated") redirect("/login");
    if (e instanceof AuthError) redirect("/forbidden");
    throw e;
  }
}

export async function requireStudentPage(): Promise<StudentContext> {
  try {
    return await authorizeStudent();
  } catch (e) {
    if (e instanceof AuthError && e.code === "unauthenticated") redirect("/login");
    if (e instanceof AuthError) redirect("/forbidden");
    throw e;
  }
}

/** Where a signed-in user should land. */
export async function homeFor(userId: string): Promise<"/inst" | "/app" | "/forbidden"> {
  if (await loadStaff(userId)) return "/inst";
  if (await loadStudent(userId)) return "/app";
  return "/forbidden";
}
