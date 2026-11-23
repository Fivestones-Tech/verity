"use server";

import { redirect } from "next/navigation";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { loadOnlineCentre } from "@/lib/billing/online-centre";
import { normaliseCentreCode } from "@/lib/auth/student-login";

export type StudentSignupState = { error: string | null };

const schema = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
  centre_code: z.string().trim().max(20).optional(),
});

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function studentNumber() {
  let s = "V";
  for (let i = 0; i < 7; i++) s += ALPHABET[randomInt(ALPHABET.length)];
  return s;
}

/**
 * A student signing up themselves (D26, D30). They sign in with their email.
 *   * No centre code: they join Verity's online centre (found from ONLINE_CENTRE_CODE).
 *   * A centre code: they ask to join that centre. Until a centre admin accepts them,
 *     institution_id stays null, so they can see none of the centre's data (rule 2).
 * Either way, paying online is the ₦1,000 price.
 */
export async function registerStudent(_prev: StudentSignupState, form: FormData): Promise<StudentSignupState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please fill in every field. Passwords need at least 8 characters." };
  const v = parsed.data;
  const centre = await loadOnlineCentre();
  if (!centre) return { error: "Signing up on your own isn't open yet. Please check back soon." };

  const admin = createSupabaseAdminClient();
  // Which centre to ask to join, if any. Looked up on the server from the typed code.
  let requested: { id: string } | null = null;
  const typed = v.centre_code ? normaliseCentreCode(v.centre_code) : "";
  if (typed && typed !== centre.code) {
    const { data } = await admin.from("institutions").select("id, status").eq("code", typed).maybeSingle();
    if (!data || ["suspended", "cancelled"].includes(data.status)) {
      return { error: "We couldn't find that centre code. Check it with your centre, or leave it empty." };
    }
    requested = { id: data.id };
  }

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.full_name },
  });
  if (userErr || !created.user) {
    // Don't reveal whether the email is registered.
    console.error("[register-student] createUser failed", userErr?.status, userErr?.code);
    return { error: "We couldn't create that account. If you already have one, sign in instead." };
  }
  const userId = created.user.id;
  await admin.from("profiles").update({ full_name: v.full_name }).eq("id", userId);

  let studentId: string | null = null;
  for (let i = 0; i < 3 && !studentId; i++) {
    const { data, error } = await admin
      .from("students")
      .insert(
        requested
          ? { profile_id: userId, institution_id: null, requested_institution_id: requested.id, full_name: v.full_name, student_number: studentNumber() }
          : { profile_id: userId, institution_id: centre.id, full_name: v.full_name, student_number: studentNumber() },
      )
      .select("id")
      .single();
    if (data) studentId = data.id;
    else if (error?.code !== "23505") break;
  }
  if (!studentId) {
    await admin.auth.admin.deleteUser(userId);
    return { error: "We couldn't set up your account. Please try again." };
  }
  await audit({
    actorUserId: userId,
    institutionId: requested?.id ?? centre.id,
    action: requested ? "student.join_requested" : "student.self_signup",
    resourceType: "student",
    resourceId: studentId,
  });

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
  redirect("/app");
}
