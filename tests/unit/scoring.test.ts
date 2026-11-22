import { describe, expect, it } from "vitest";
import { scoreAttempt, type KeyedQuestion } from "@/lib/scoring/score";

const key: KeyedQuestion[] = [
  { question_id: "q1", topic_id: "alg", points: 1, correct_option_id: "q1a", option_ids: ["q1a", "q1b", "q1c", "q1d"] },
  { question_id: "q2", topic_id: "alg", points: 1, correct_option_id: "q2b", option_ids: ["q2a", "q2b", "q2c", "q2d"] },
  { question_id: "q3", topic_id: "geo", points: 2, correct_option_id: "q3c", option_ids: ["q3a", "q3b", "q3c", "q3d"] },
  { question_id: "q4", topic_id: "geo", points: 1, correct_option_id: "q4d", option_ids: ["q4a", "q4b", "q4c", "q4d"] },
];

describe("scoreAttempt", () => {
  it.each([
    { name: "all correct", sel: { q1: "q1a", q2: "q2b", q3: "q3c", q4: "q4d" }, score: 5, pct: 100, c: 4, i: 0, u: 0 },
    { name: "nothing answered", sel: {}, score: 0, pct: 0, c: 0, i: 0, u: 4 },
    { name: "mixed", sel: { q1: "q1a", q2: "q2a", q3: "q3c" }, score: 3, pct: 60, c: 2, i: 1, u: 1 },
    { name: "cleared answer counts as blank", sel: { q1: null, q3: "q3c" }, score: 2, pct: 40, c: 1, i: 0, u: 3 },
  ])("$name", ({ sel, score, pct, c, i, u }) => {
    const r = scoreAttempt(key, new Map(Object.entries(sel)));
    expect(r.score).toBe(score);
    expect(r.max_score).toBe(5);
    expect(r.percentage).toBe(pct);
    expect([r.correct_count, r.incorrect_count, r.unanswered_count]).toEqual([c, i, u]);
  });

  it("treats an option from another question as no answer (tamper guard)", () => {
    const r = scoreAttempt(key, new Map([["q1", "q2b"]]));
    expect(r.correct_count).toBe(0);
    expect(r.unanswered_count).toBe(4);
    expect(r.questions[0].selected_option_id).toBeNull();
  });

  it("breaks results down by topic, counting blanks as not correct", () => {
    const r = scoreAttempt(key, new Map([["q1", "q1a"], ["q3", "q3a"]]));
    const alg = r.topics.find((t) => t.topic_id === "alg")!;
    const geo = r.topics.find((t) => t.topic_id === "geo")!;
    expect(alg).toMatchObject({ questions_total: 2, questions_attempted: 1, correct_answers: 1, percentage: 50 });
    expect(geo).toMatchObject({ questions_total: 2, questions_attempted: 1, correct_answers: 0, percentage: 0 });
  });

  it("is deterministic", () => {
    const sel = new Map([["q1", "q1a"], ["q4", "q4d"]]);
    expect(scoreAttempt(key, sel)).toEqual(scoreAttempt(key, sel));
  });
});
