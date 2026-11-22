import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import type { StaffContext } from "@/lib/auth/session";
import { DomainError } from "@/lib/api";
import { generatePassword } from "@/lib/auth/student-login";

export async function addStaffMember(staff: StaffContext, v: { full_name: string; email: string; role: "admin" | "teacher" }) {
  if (v.role === "admin" && !staff.roles.includes("owner")) {
    throw new DomainError("forbidden", "Only the centre owner can add admins.", 403);
  }
  const admin = createSupabaseAdminClient();
  const password = generatePassword(10);
  const { data, error } = await admin.auth.admin.createUser({
    email: v.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: v.full_name },
  });
  if (error || !data.user) {
    console.error("[staff] createUser failed", error?.status, error?.code);
    // Same message either way: don't confirm whether an email has an account.
    throw new DomainError("staff_failed", "We couldn't add that person. If they already use Verity, contact the Verity team to link their account.");
  }
  await admin.from("profiles").update({ full_name: v.full_name }).eq("id", data.user.id);
  const { error: mErr } = await admin.from("institution_memberships").insert({ institution_id: staff.institution.id, user_id: data.user.id, role: v.role });
  if (mErr) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw new DomainError("staff_failed", "We couldn't add that person. Please try again.", 500);
  }
  await audit({ actorUserId: staff.userId, institutionId: staff.institution.id, action: "staff.added", resourceType: "membership", metadata: { role: v.role, email: v.email } });
  return password;
}

export async function createClass(staff: StaffContext, name: string) {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("classes").insert({ institution_id: staff.institution.id, name });
  if (error?.code === "23505") throw new DomainError("duplicate_class", "A class with that name already exists.");
  if (error) throw new DomainError("class_failed", "We couldn't create the class. Please try again.", 500);
}

export async function setClassTeacher(staff: StaffContext, classId: string, userId: string, assign: boolean) {
  const admin = createSupabaseAdminClient();
  const [{ data: c }, { data: m }] = await Promise.all([
    admin.from("classes").select("institution_id").eq("id", classId).maybeSingle(),
    admin.from("institution_memberships").select("id").eq("institution_id", staff.institution.id).eq("user_id", userId).eq("status", "active").limit(1),
  ]);
  if (!c || c.institution_id !== staff.institution.id || !m?.length) throw new DomainError("not_found", "We couldn't find that class or teacher.", 404);
  if (assign) await admin.from("class_teachers").upsert({ class_id: classId, user_id: userId }, { onConflict: "class_id,user_id" });
  else await admin.from("class_teachers").delete().eq("class_id", classId).eq("user_id", userId);
}
