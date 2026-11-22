import { beforeAll, describe, expect, it } from "vitest";
import { admin, makeCentre, type Centre } from "../support/fixtures";
import { createTopicTest } from "@/lib/assessments/service";
import { getAttemptPayload, saveAnswers, startAttempt, submitAttempt } from "@/lib/attempts/service";
import { DomainError } from "@/lib/api";

let C: Centre;
let testId: string;

async function newTest(minutes = 10) {
  return createTopicTest(C.staffCtx(C.teacher, ["teacher"]), {
    name: `T ${Math.random()}`, subject_id: C.subject.id, topic_ids: [C.topic.id], question_count: 4, duration_minutes: minutes,
    difficulties: [], assign_to: ["all"], open_now: true,
  });
}
const nowIso = () => new Date().toISOString();

beforeAll(async () => {
  C = await makeCentre("GAMMA");
  testId = await newTest();
});

describe("attempt lifecycle", () => {
  it("never sends the answer key to the student", async () => {
    const p = await startAttempt(C.studentCtx(0), testId);
    expect(p.questions).toHaveLength(4);
    expect(JSON.stringify(p)).not.toContain("is_correct");
    for (const q of p.questions) expect(q.options).toHaveLength(4);
  });

  it("starting twice resumes the same attempt", async () => {
    const a = await startAttempt(C.studentCtx(0), testId);
    const b = await startAttempt(C.studentCtx(0), testId);
    expect(a.attempt_id).toBe(b.attempt_id);
    const { count } = await admin.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("assessment_id", testId).eq("student_id", C.students[0].id);
    expect(count).toBe(1);
  });

  it("concurrent Begin taps create only one attempt", async () => {
    const t = await newTest();
    const results = await Promise.all([startAttempt(C.studentCtx(1), t), startAttempt(C.studentCtx(1), t), startAttempt(C.studentCtx(1), t)]);
    expect(new Set(results.map((r) => r.attempt_id)).size).toBe(1);
  });

  it("keeps the highest seq per question, whatever order batches arrive in", async () => {
    const t = await newTest();
    const p = await startAttempt(C.studentCtx(0), t);
    const q = p.questions[0];
    await saveAnswers(C.studentCtx(0), p.attempt_id, [{ question_id: q.id, selected_option_id: q.options[2].id, seq: 5, answered_at: nowIso() }]);
    await saveAnswers(C.studentCtx(0), p.attempt_id, [{ question_id: q.id, selected_option_id: q.options[1].id, seq: 3, answered_at: nowIso() }]); // stale retry
    const again = await getAttemptPayload(C.studentCtx(0), p.attempt_id);
    expect(again.saved.find((s) => s.question_id === q.id)).toMatchObject({ selected_option_id: q.options[2].id, seq: 5 });
  });

  it("rejects tampering: other questions, other options, other students", async () => {
    const t = await newTest();
    const p = await startAttempt(C.studentCtx(0), t);
    const r = await saveAnswers(C.studentCtx(0), p.attempt_id, [
      { question_id: crypto.randomUUID(), selected_option_id: null, seq: 1, answered_at: nowIso() },
      { question_id: p.questions[0].id, selected_option_id: p.questions[1].options[0].id, seq: 2, answered_at: nowIso() },
    ]);
    expect(r.rejected.map((x) => x.reason).sort()).toEqual(["invalid_option", "not_in_attempt"]);
    await expect(saveAnswers(C.studentCtx(1), p.attempt_id, [])).rejects.toBeInstanceOf(DomainError);
  });

  it("scores on the server and a duplicate submit returns the same result without re-scoring", async () => {
    const t = await newTest();
    const p = await startAttempt(C.studentCtx(0), t);
    const key = new Map(C.questions.map((q) => [q.id, q]));
    const answers = p.questions.map((q, i) => ({
      question_id: q.id,
      // first two right, third wrong, fourth blank
      selected_option_id: i < 2 ? key.get(q.id)!.correct : i === 2 ? key.get(q.id)!.wrong : null,
      seq: i + 1,
      answered_at: nowIso(),
    }));
    const first = await submitAttempt(C.studentCtx(0), p.attempt_id, { submission_key: "key-aaaaaaaa", answers, reason: "student" });
    const second = await submitAttempt(C.studentCtx(0), p.attempt_id, { submission_key: "key-bbbbbbbb", answers: [], reason: "student" });
    expect(first).toMatchObject({ status: "submitted", already_submitted: false });
    expect(second).toMatchObject({ status: "submitted", already_submitted: true });
    const { data: at } = await admin.from("assessment_attempts").select("*").eq("id", p.attempt_id).single();
    expect(at).toMatchObject({ score: 2, max_score: 4, percentage: 50, correct_count: 2, incorrect_count: 1, unanswered_count: 1, submission_key: "key-aaaaaaaa" });
    const { data: tp } = await admin.from("topic_performance").select("*").eq("attempt_id", p.attempt_id);
    expect(tp).toHaveLength(1);
    expect(tp![0]).toMatchObject({ questions_total: 4, correct_answers: 2, questions_attempted: 3 });
    // and no more answers are accepted
    await expect(saveAnswers(C.studentCtx(0), p.attempt_id, answers)).rejects.toMatchObject({ code: "attempt_closed" });
    // one attempt only
    await expect(startAttempt(C.studentCtx(0), t)).rejects.toMatchObject({ code: "attempt_limit_reached" });
  });

  it("concurrent submits score exactly once", async () => {
    const t = await newTest();
    const p = await startAttempt(C.studentCtx(1), t);
    const body = { submission_key: "key-cccccccc", answers: [], reason: "student" as const };
    const rs = await Promise.all([1, 2, 3].map(() => submitAttempt(C.studentCtx(1), p.attempt_id, body)));
    expect(rs.filter((r) => !r.already_submitted)).toHaveLength(1);
    const { count } = await admin.from("topic_performance").select("id", { count: "exact", head: true }).eq("attempt_id", p.attempt_id);
    expect(count).toBe(1);
  });

  it("after time runs out: answers chosen in time still count, later ones are rejected", async () => {
    const t = await newTest(1);
    const p = await startAttempt(C.studentCtx(0), t);
    // pretend the timer ended 5 minutes ago (past the 60 s grace)
    const expired = new Date(Date.now() - 5 * 60_000);
    await admin.from("assessment_attempts").update({ started_at: new Date(expired.getTime() - 60_000).toISOString(), expires_at: expired.toISOString() }).eq("id", p.attempt_id);
    const q0 = p.questions[0];
    const q1 = p.questions[1];
    const r = await submitAttempt(C.studentCtx(0), p.attempt_id, {
      submission_key: "key-dddddddd",
      reason: "timer",
      answers: [
        { question_id: q0.id, selected_option_id: q0.options[0].id, seq: 1, answered_at: new Date(expired.getTime() - 10_000).toISOString() },
        { question_id: q1.id, selected_option_id: q1.options[0].id, seq: 2, answered_at: new Date(expired.getTime() + 60_000).toISOString() },
      ],
    });
    expect(r.status).toBe("auto_submitted");
    expect(r.rejected).toEqual([{ question_id: q1.id, reason: "after_time_limit" }]);
    const { data: at } = await admin.from("assessment_attempts").select("synced_late, unanswered_count").eq("id", p.attempt_id).single();
    expect(at).toMatchObject({ synced_late: true, unanswered_count: 3 });
  });

  it("a student can't open a test that isn't assigned to them", async () => {
    const other = await makeCentre("DELTA");
    await expect(startAttempt(other.studentCtx(0), testId)).rejects.toMatchObject({ code: "assessment_not_found" });
  });
});
