import "server-only";
import { randomInt } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DomainError } from "@/lib/api";
import { audit } from "@/lib/audit";
import type { StaffContext } from "@/lib/auth/session";
import { loadOnlineCentre } from "@/lib/billing/online-centre";

/**
 * Students who signed up themselves and typed this centre's code (D30). Only the
 * centre's owner/admin sees them (caller checks MANAGER_ROLES), and only for their
 * own centre: the filter comes from the verified staff context, never the form.
 */
export async function listJoinRequests(staff: StaffContext) {
  const { data } = await createSupabaseAdminClient()
    .from("students")
    .select("id, full_name, created_at, profile:profiles(email)")
    .eq("requested_institution_id", staff.institution.id)
    .is("institution_id", null)
    .order("created_at");
  type Row = { id: string; full_name: string; created_at: string; profile: { email: string | null } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({ id: r.id, full_name: r.full_name, created_at: r.created_at, email: r.profile?.email ?? null }));
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newNumber = () => "V" + Array.from({ length: 7 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

export async function decideJoinRequest(staff: StaffContext, studentId: string, accept: boolean) {
  const admin = createSupabaseAdminClient();
  const { data: st } = await admin.from("students").select("id, requested_institution_id, institution_id").eq("id", studentId).maybeSingle();
  if (!st || st.requested_institution_id !== staff.institution.id || st.institution_id !== null) {
    throw new DomainError("request_not_found", "We couldn't find that request.", 404);
  }

  if (accept) {
    for (let i = 0; i < 3; i++) {
      const { error } = await admin
        .from("students")
        .update({ institution_id: staff.institution.id, requested_institution_id: null, ...(i > 0 ? { student_number: newNumber() } : {}), updated_at: new Date().toISOString() })
        .eq("id", studentId)
        .eq("requested_institution_id", staff.institution.id);
      if (!error) break;
      if (error.code !== "23505" || i === 2) {
        console.error("[join] accept failed", error.message);
        throw new DomainError("join_failed", "We couldn't add that student. Please try again.", 500);
      }
    }
  } else {
    // Declined: they keep their account and use Verity on their own (online centre).
    const online = await loadOnlineCentre();
    await admin
      .from("students")
      .update({ institution_id: online?.id ?? null, requested_institution_id: null, updated_at: new Date().toISOString() })
      .eq("id", studentId)
      .eq("requested_institution_id", staff.institution.id);
  }
  await audit({ actorUserId: staff.userId, institutionId: staff.institution.id, action: accept ? "student.join_accepted" : "student.join_declined", resourceType: "student", resourceId: studentId });
}
