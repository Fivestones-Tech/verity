import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/** Integration tests run against the local Supabase stack (`npm run db:start`). */
function loadEnv() {
  const file = path.resolve(import.meta.dirname, "../../.env.local");
  try {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {
    /* rely on the environment */
  }
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("127.0.0.1") && !process.env.ALLOW_NON_LOCAL_TESTS) {
    throw new Error("Integration tests only run against a local Supabase (127.0.0.1). Never point them at production.");
  }
}
loadEnv();

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
export const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

export async function signedIn(email: string, password: string): Promise<SupabaseClient> {
  const c = createClient(url, anonKey, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

async function user(email: string, name: string) {
  const password = "Test-pass-123";
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: name } });
  if (error) throw error;
  return { id: data.user!.id, email, password };
}

export type Centre = Awaited<ReturnType<typeof makeCentre>>;

/** A centre with an owner, a teacher (assigned to class A), a second reviewer, two students and published questions. */
export async function makeCentre(label: string) {
  const tag = randomUUID().slice(0, 6).toUpperCase();
  const code = `${label}${tag}`.replace(/[^A-Z0-9]/g, "").slice(0, 12);
  const { data: inst } = await admin.from("institutions").insert({ name: `${label} Centre`, code, type: "tutorial_centre", exam_focus: "jamb_only" }).select().single();
  const owner = await user(`owner.${tag.toLowerCase()}@example.test`, `${label} Owner`);
  const teacher = await user(`teacher.${tag.toLowerCase()}@example.test`, `${label} Teacher`);
  const otherTeacher = await user(`teacher2.${tag.toLowerCase()}@example.test`, `${label} Teacher Two`);
  await admin.from("institution_memberships").insert([
    { institution_id: inst!.id, user_id: owner.id, role: "owner" },
    { institution_id: inst!.id, user_id: teacher.id, role: "teacher" },
    { institution_id: inst!.id, user_id: otherTeacher.id, role: "teacher" },
  ]);
  const { data: classA } = await admin.from("classes").insert({ institution_id: inst!.id, name: "Class A" }).select().single();
  const { data: classB } = await admin.from("classes").insert({ institution_id: inst!.id, name: "Class B" }).select().single();
  await admin.from("class_teachers").insert({ class_id: classA!.id, user_id: teacher.id });

  const s1u = await user(`s1.${tag.toLowerCase()}@students.example.test`, `${label} Student One`);
  const s2u = await user(`s2.${tag.toLowerCase()}@students.example.test`, `${label} Student Two`);
  const { data: s1 } = await admin.from("students").insert({ profile_id: s1u.id, institution_id: inst!.id, full_name: `${label} Student One`, student_number: "S1", class_id: classA!.id }).select().single();
  const { data: s2 } = await admin.from("students").insert({ profile_id: s2u.id, institution_id: inst!.id, full_name: `${label} Student Two`, student_number: "S2", class_id: classB!.id }).select().single();

  const { data: subject } = await admin.from("subjects").select("id, examination_id, exam:examinations!inner(code)").eq("code", "MTH").eq("exam.code", "JAMB").single();
  const { data: topic } = await admin.from("topics").insert({ subject_id: subject!.id, name: `Algebra ${tag}`, institution_id: inst!.id }).select().single();
  const questions: { id: string; correct: string; wrong: string }[] = [];
  for (let i = 0; i < 6; i++) {
    const { data: q } = await admin
      .from("questions")
      .insert({ subject_id: subject!.id, topic_id: topic!.id, examination_id: subject!.examination_id, institution_id: inst!.id, question_text: `${label} Q${i}`, difficulty: "easy", source: "original", status: "published", created_by: teacher.id, reviewed_by: owner.id })
      .select()
      .single();
    const { data: opts } = await admin
      .from("question_options")
      .insert(["A", "B", "C", "D"].map((k) => ({ question_id: q!.id, option_key: k, option_text: `${k}${i}`, is_correct: k === "A" })))
      .select();
    questions.push({ id: q!.id, correct: opts!.find((o) => o.is_correct)!.id, wrong: opts!.find((o) => !o.is_correct)!.id });
  }

  const institution = { id: inst!.id, name: inst!.name, code: inst!.code, type: inst!.type, exam_focus: inst!.exam_focus };
  return {
    institution, owner, teacher, otherTeacher, classA: classA!, classB: classB!, subject: subject!, topic: topic!, questions,
    students: [
      { ...s1!, login: s1u },
      { ...s2!, login: s2u },
    ],
    staffCtx: (who: { id: string }, roles: ("owner" | "teacher")[]) => ({ userId: who.id, fullName: "", institution, roles }),
    studentCtx: (i: 0 | 1) => ({ userId: [s1u, s2u][i].id, student: { id: [s1!, s2!][i].id, full_name: "", institution_id: inst!.id, class_id: [s1!, s2!][i].class_id } }),
  };
}
