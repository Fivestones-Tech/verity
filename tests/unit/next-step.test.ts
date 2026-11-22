import { describe, expect, it } from "vitest";
import { nextStep, topicBand } from "@/lib/scoring/next-step";

describe("topicBand", () => {
  it.each([
    [40, 10, "needs_attention"],
    [55, 10, "developing"],
    [70, 10, "good"],
    [90, 10, "strong"],
    [100, 3, "not_enough_evidence"],
    [0, 4, "not_enough_evidence"],
  ] as const)("%s%% on %s questions -> %s", (pct, n, band) => {
    expect(topicBand(pct, n)).toBe(band);
  });
});

describe("nextStep", () => {
  const topics = [
    { topic_id: "a", name: "Algebra", percentage: 40, questions_total: 10 },
    { topic_id: "b", name: "Geometry", percentage: 80, questions_total: 10 },
  ];
  it("points at the weakest topic", () => {
    expect(nextStep({ topics, unansweredCount: 0, totalQuestions: 20, autoSubmitted: false })).toMatchObject({ kind: "practice_topic", topic_id: "a" });
  });
  it("flags time management when time ran out with many blanks", () => {
    expect(nextStep({ topics, unansweredCount: 6, totalQuestions: 20, autoSubmitted: true }).kind).toBe("time_management");
  });
  it("moves on when every topic is strong", () => {
    expect(nextStep({ topics: [{ topic_id: "b", name: "G", percentage: 85, questions_total: 10 }], unansweredCount: 0, totalQuestions: 10, autoSubmitted: false }).kind).toBe("move_on");
  });
});
