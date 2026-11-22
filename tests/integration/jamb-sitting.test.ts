import { beforeAll, describe, expect, it } from "vitest";
import { admin, makeCentre, signedIn, type Centre } from "../support/fixtures";
import { createJambSitting } from "@/lib/assessments/service";
import { setStudentSubjects } from "@/lib/students/service";
import { getAttemptPayload, startAttempt, submitAttempt } from "@/lib/attempts/service";
import { jambBreakdowns } from "@/lib/assessments/jamb-results";

/** Full JAMB sitting: English + each student's own 3 subjects, scored /100 per subject. */
let C: Centre;
let Other: Centre;
const subj: Record<string, { id: string; examination_id: string }> = {};
const correctOf = new Map<string, string>();

async function addQuestions(code: string, n: number) {
  const s = subj[code];
  const { data: topic } = await admin.from("topics").insert({ subject_id: s.id, name: `${code} topic ${Math.random()}`, institution_id: C.institution.id }).select().single();
  for (let i = 0; i < n; i++) {
    const { data: q } = await admin.from("questions").insert({
      subject_id: s.id, topic_id: topic!.id, examination_id: s.examination_id, institution_id: C.institution.id,
      question_text: `${code} Q${i}`, difficulty: "easy", source: "original", status: "published", created_by: C.teacher.id, reviewed_by: C.owner.id,
    }).select().single();
    const { data: opts } = await admin.from("question_options")
      .insert(["A", "B", "C", "D"].map((k) => ({ question_id: q!.id, option_key: k, option_text: `${k}`, is_correct: k === "A" }))).select();
    correctOf.set(q!.id, opts!.find((o) => o.is_correct)!.id);
  }
}

const sitting = (extra: Partial<Parameters<typeof createJambSitting>[1]> = {}) =>
  createJambSitting(C.staffCtx(C.teacher, ["teacher"]), {
    name: `Full mock ${Math.random()}`, english_questions: 3, other_questions: 2, duration_minutes: 120,
    assign_to: ["all"], open_now: true, ...extra,
  });

beforeAll(async () => {
  C = await makeCentre("SITA");
  Other = await makeCentre("SITB");
  const { data } = await admin.from("subjects").select("id, code, examination_id, exam:examinations!inner(code)").eq("exam.code", "JAMB");
  for (const s of data ?? []) subj[s.code] = { id: s.id, examination_id: s.examination_id };
  await addQuestions("ENG", 3);
  await addQuestions("PHY", 2);
  await addQuestions("CHM", 2);
  // MTH already has 6 published questions from the fixture
  const { data: mq } = await admin.from("question_options").select("id, question_id").in("question_id", C.questions.map((q) => q.id)).eq("is_correct", true);
  for (const o of mq ?? []) correctOf.set(o.question_id, o.id);
  // student 0: Maths, Physics, Chemistry (English is implied). Student 1: not set.
  await setStudentSubjects(C.staffCtx(C.owner, ["owner"]), C.students[0].id, [subj.MTH.id, subj.PHY.id, subj.CHM.id, subj.ENG.id]);
});

describe("student subjects", () => {
  it("needs exactly 3 subjects besides English", async () => {
    await expect(setStudentSubjects(C.staffCtx(C.owner, ["owner"]), C.students[1].id, [subj.MTH.id, subj.PHY.id])).rejects.toMatchObject({ code: "invalid_subjects" });
  });
  it("can't be set on another centre's student", async () => {
    await expect(setStudentSubjects(Other.staffCtx(Other.owner, ["owner"]), C.students[0].id, [subj.MTH.id, subj.PHY.id, subj.CHM.id])).rejects.toMatchObject({ code: "student_not_found" });
  });
  it("another centre's staff can't read them (RLS)", async () => {
    const c = await signedIn(Other.owner.email, Other.owner.password);
    const { data } = await c.from("student_subjects").select("subject_id").eq("student_id", C.students[0].id);
    expect(data ?? []).toHaveLength(0);
  });
  it("the student can read their own", async () => {
    const c = await signedIn(C.students[0].login.email, C.students[0].login.password);
    const { data } = await c.from("student_subjects").select("subject_id").eq("student_id", C.students[0].id);
    expect(new Set((data ?? []).map((r) => r.subject_id))).toEqual(new Set([subj.MTH.id, subj.PHY.id, subj.CHM.id]));
  });
});

describe("full JAMB sitting", () => {
  let id: string;
  beforeAll(async () => {
    id = await sitting();
  });

  it("is saved as a jamb_utme mock with no single subject", async () => {
    const { data } = await admin.from("assessments").select("format, assessment_type, subject_id, question_count").eq("id", id).single();
    expect(data).toMatchObject({ format: "jamb_utme", assessment_type: "mock", subject_id: null, question_count: 3 + 3 * 2 });
  });

  it("gives the student English first, then their 3 subjects", async () => {
    const p = await startAttempt(C.studentCtx(0), id);
    expect(p.questions).toHaveLength(9);
    expect(p.questions.slice(0, 3).every((q) => q.subject === "Use of English" || q.subject.includes("English"))).toBe(true);
    const papers = [...new Set(p.questions.map((q) => q.subject))];
    expect(papers).toHaveLength(4);
  });

  it("refuses a student whose subjects aren't set", async () => {
    await expect(startAttempt(C.studentCtx(1), id)).rejects.toMatchObject({ code: "subjects_not_set" });
  });

  it("scores each subject out of 100 and totals out of 400", async () => {
    const p = await getAttemptPayload(C.studentCtx(0), (await startAttempt(C.studentCtx(0), id)).attempt_id);
    // English all right, everything else blank
    const english = p.questions.slice(0, 3);
    await submitAttempt(C.studentCtx(0), p.attempt_id, {
      submission_key: crypto.randomUUID(),
      reason: "student",
      answers: english.map((q, i) => ({ question_id: q.id, selected_option_id: correctOf.get(q.id)!, seq: i + 1, answered_at: new Date().toISOString() })),
    });
    const b = (await jambBreakdowns([p.attempt_id])).get(p.attempt_id)!;
    expect(b.max).toBe(400);
    expect(b.subjects[0]).toMatchObject({ correct: 3, total: 3, score: 100 });
    expect(b.subjects.slice(1).map((s) => s.score)).toEqual([0, 0, 0]);
    expect(b.total).toBe(100);
  });

  it("refuses when English doesn't have enough questions", async () => {
    await expect(sitting({ english_questions: 10 })).rejects.toMatchObject({ code: "not_enough_questions" });
  });

  it("refuses when no student's subjects are all covered", async () => {
    await expect(sitting({ other_questions: 5 })).rejects.toMatchObject({ code: "not_enough_questions" });
  });

  it("leaves out a subject without enough questions, and its students can't start", async () => {
    // student 1 takes Biology, which has no questions; student 0 is still covered
    await setStudentSubjects(C.staffCtx(C.owner, ["owner"]), C.students[1].id, [subj.MTH.id, subj.PHY.id, subj.BIO.id]);
    const partial = await sitting();
    await expect(startAttempt(C.studentCtx(1), partial)).rejects.toMatchObject({ code: "subject_not_in_sitting" });
    expect((await startAttempt(C.studentCtx(0), partial)).questions).toHaveLength(9);
  });
});
