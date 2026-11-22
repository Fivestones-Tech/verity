"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { audit } from "@/lib/audit";
import { normaliseCentreCode } from "@/lib/auth/student-login";

export type RegisterState = { error: string | null };

const schema = z.object({
  centre_name: z.string().trim().min(3).max(120),
  centre_code: z.string().trim().min(3).max(12),
  type: z.enum(["tutorial_centre", "school"]),
  exam_focus: z.enum(["jamb_only", "waec_only", "both"]),
  full_name: z.string().trim().min(2).max(120),
  email: z.email(),
  password: z.string().min(8).max(200),
  signup_code: z.string().optional(),
});

export async function registerInstitution(_prev: RegisterState, form: FormData): Promise<RegisterState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { error: "Please fill in every field. Passwords need at least 8 characters, and the centre code 3 to 12 letters or numbers." };
  }
  const v = parsed.data;
  // While Verity is in a closed pilot, registering a centre needs a code from Lumio.
  const required = process.env.CENTRE_SIGNUP_CODE;
  if (required && v.signup_code !== required) {
    return { error: "That pilot access code isn't right. Ask the Verity team for your code." };
  }
  const code = normaliseCentreCode(v.centre_code);
  if (!/^[A-Z0-9]{3,12}$/.test(code)) return { error: "The centre code can only use letters and numbers (3 to 12)." };

  const admin = createSupabaseAdminClient();
  const { data: taken } = await admin.from("institutions").select("id").eq("code", code).maybeSingle();
  if (taken) return { error: "That centre code is already in use. Please choose another." };

  const { data: created, error: userErr } = await admin.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
    user_metadata: { full_name: v.full_name },
  });
  if (userErr || !created.user) {
    // Don't reveal whether the email is registered.
    console.error("[register] createUser failed", userErr?.status, userErr?.code);
    return { error: "We couldn't create that account. If you already have one, sign in instead." };
  }
  const userId = created.user.id;

  const { data: inst, error: instErr } = await admin
    .from("institutions")
    .insert({ name: v.centre_name, code, type: v.type, exam_focus: v.exam_focus, contact_email: v.email })
    .select("id")
    .single();
  if (instErr || !inst) {
    await admin.auth.admin.deleteUser(userId);
    console.error("[register] institution insert failed", instErr?.message);
    return { error: "We couldn't set up your centre. Please try again." };
  }
  await admin.from("profiles").update({ full_name: v.full_name }).eq("id", userId);
  await admin.from("institution_memberships").insert({ institution_id: inst.id, user_id: userId, role: "owner" });
  await audit({ actorUserId: userId, institutionId: inst.id, action: "institution.created", resourceType: "institution", resourceId: inst.id });

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signInWithPassword({ email: v.email, password: v.password });
  redirect("/inst");
}
