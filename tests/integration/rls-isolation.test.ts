import { beforeAll, describe, expect, it } from "vitest";
import { admin, makeCentre, signedIn, type Centre } from "../support/fixtures";
import { createAssessment } from "@/lib/assessments/service";
import { startAttempt } from "@/lib/attempts/service";

/**
 * docs/06 + docs/20: institution isolation tested with two real centres.
 * Every query here runs as a signed-in user through RLS, exactly like the app.
 */
let A: Centre;
let B: Centre;
let testA: string;

beforeAll(async () => {
  A = await makeCentre("ALPHA");
  B = await makeCentre("BETA");
  testA = await createAssessment(A.staffCtx(A.teacher, ["teacher"]), {
    name: "Alpha algebra", subject_id: A.subject.id, topic_ids: [A.topic.id], question_count: 4, duration_minutes: 10,
    kind: "topic_test", difficulties: [], assign_to: ["all"], open_now: true,
  });
  await startAttempt(A.studentCtx(0), testA);
});

describe("cross-centre isolation", () => {
  const tables = ["institutions", "students", "classes", "questions", "question_options", "assessments", "assessment_attempts", "responses", "topics", "audit_logs", "institution_memberships"] as const;

  it.each(tables)("centre B's owner cannot read any of centre A's %s", async (table) => {
    const c = await signedIn(B.owner.email, B.owner.password);
    const { data, error } = await c.from(table).select("*");
    expect(error).toBeNull();
    const leaked = (data ?? []).filter((row: Record<string, unknown>) =>
      row.institution_id === A.institution.id || row.id === A.institution.id ||
      row.question_id === A.questions[0].id || row.assessment_id === testA ||
      (typeof row.student_id === "string" && A.students.some((s) => s.id === row.student_id)),
    );
    expect(leaked).toEqual([]);
  });

  it("a guessed id from another centre returns nothing", async () => {
    const c = await signedIn(B.teacher.email, B.teacher.password);
    const { data } = await c.from("questions").select("id").eq("id", A.questions[0].id);
    expect(data).toEqual([]);
    const { data: s } = await c.from("students").select("id").eq("id", A.students[0].id);
    expect(s).toEqual([]);
  });

  it("signed-out visitors see nothing", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    for (const t of ["students", "questions", "question_options", "assessments", "institutions"]) {
      const { data } = await anon.from(t).select("id");
      expect(data ?? []).toEqual([]);
    }
  });
});

describe("roles inside one centre", () => {
  it("a teacher sees only students in classes they teach; the owner sees all", async () => {
    const t = await signedIn(A.teacher.email, A.teacher.password);
    const { data: seen } = await t.from("students").select("id");
    expect(seen!.map((s) => s.id)).toEqual([A.students[0].id]);
    const o = await signedIn(A.owner.email, A.owner.password);
    const { data: all } = await o.from("students").select("id");
    expect(all!.map((s) => s.id).sort()).toEqual(A.students.map((s) => s.id).sort());
  });

  it("students can never read the answer key or the question bank", async () => {
    const s = await signedIn(A.students[0].login.email, A.students[0].login.password);
    const { data: opts } = await s.from("question_options").select("is_correct");
    expect(opts).toEqual([]);
    const { data: qs } = await s.from("questions").select("id");
    expect(qs).toEqual([]);
    const { data: aq } = await s.from("assessment_questions").select("question_id");
    expect(aq).toEqual([]);
  });

  it("a student sees their own attempt, not a classmate's", async () => {
    const s2 = await signedIn(A.students[1].login.email, A.students[1].login.password);
    const { data } = await s2.from("assessment_attempts").select("id, student_id");
    expect(data).toEqual([]);
    const s1 = await signedIn(A.students[0].login.email, A.students[0].login.password);
    const { data: own } = await s1.from("assessment_attempts").select("student_id");
    expect(own!.map((r) => r.student_id)).toEqual([A.students[0].id]);
  });

  it("a student only sees tests assigned to them", async () => {
    const classOnly = await createAssessment(A.staffCtx(A.owner, ["owner"]), {
      name: "Class B only", subject_id: A.subject.id, topic_ids: [A.topic.id], question_count: 2, duration_minutes: 5,
      kind: "topic_test", difficulties: [], assign_to: [A.classB.id], open_now: true,
    });
    const s1 = await signedIn(A.students[0].login.email, A.students[0].login.password);
    const { data } = await s1.from("assessments").select("id");
    expect(data!.map((a) => a.id)).not.toContain(classOnly);
    const s2 = await signedIn(A.students[1].login.email, A.students[1].login.password);
    const { data: d2 } = await s2.from("assessments").select("id");
    expect(d2!.map((a) => a.id)).toContain(classOnly);
  });
});

describe("no direct writes from the browser", () => {
  it.each(["questions", "assessment_attempts", "responses", "students", "institution_memberships"])("authenticated users cannot insert into %s", async (table) => {
    const s = await signedIn(A.students[0].login.email, A.students[0].login.password);
    const { error } = await s.from(table).insert({ id: crypto.randomUUID() });
    expect(error).not.toBeNull();
  });

  it("a student cannot change their own score", async () => {
    const s = await signedIn(A.students[0].login.email, A.students[0].login.password);
    await s.from("assessment_attempts").update({ score: 999 }).eq("student_id", A.students[0].id);
    const { data } = await admin.from("assessment_attempts").select("score").eq("student_id", A.students[0].id);
    expect(data!.every((r) => r.score !== 999)).toBe(true);
  });

  it("the server-only write functions can't be called by users", async () => {
    const s = await signedIn(A.students[0].login.email, A.students[0].login.password);
    const { error } = await s.rpc("save_responses", { p_attempt_id: crypto.randomUUID(), p_items: [] });
    expect(error).not.toBeNull();
  });
});
