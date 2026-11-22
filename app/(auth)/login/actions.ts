"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { homeFor } from "@/lib/auth/session";
import { studentLoginEmail } from "@/lib/auth/student-login";

export type LoginState = { error: string | null };

// One message for every failure, so the form never reveals which accounts exist (docs/06).
const GENERIC = "Those details don't match our records. Check them and try again.";

const staffSchema = z.object({ email: z.email(), password: z.string().min(1).max(200) });
const studentSchema = z.object({
  centre: z.string().min(2).max(20),
  number: z.string().min(1).max(40),
  password: z.string().min(1).max(200),
});

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const mode = form.get("mode") === "student" ? "student" : "staff";
  let email: string;
  let password: string;
  if (mode === "student") {
    const p = studentSchema.safeParse({ centre: form.get("centre"), number: form.get("number"), password: form.get("password") });
    if (!p.success) return { error: "Enter your centre code, student number and password." };
    email = studentLoginEmail(p.data.centre, p.data.number, process.env.STUDENT_LOGIN_DOMAIN ?? "students.verity.invalid");
    password = p.data.password;
  } else {
    const p = staffSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!p.success) return { error: "Enter your email and password." };
    email = p.data.email;
    password = p.data.password;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    if (error && error.status !== 400) console.error("[login] sign-in error", error.status, error.code);
    return { error: GENERIC };
  }
  redirect(await homeFor(data.user.id));
}
