import { describe, expect, it } from "vitest";
import { pickQuestions, type PoolQuestion } from "@/lib/assessments/pick";

const pool: PoolQuestion[] = [
  ...Array.from({ length: 10 }, (_, i) => ({ id: `a${i}`, topic_id: "A", difficulty: (i % 2 ? "easy" : "difficult") as PoolQuestion["difficulty"] })),
  ...Array.from({ length: 3 }, (_, i) => ({ id: `b${i}`, topic_id: "B", difficulty: "moderate" as const })),
  { id: "c0", topic_id: "C", difficulty: "easy" },
];

describe("pickQuestions", () => {
  it("spreads evenly across topics", () => {
    const r = pickQuestions(pool, { topicIds: ["A", "B"], count: 6 });
    expect(r.perTopic).toEqual({ A: 3, B: 3 });
    expect(new Set(r.ids).size).toBe(6);
  });
  it("fills from bigger topics when a small topic runs out", () => {
    const r = pickQuestions(pool, { topicIds: ["A", "B"], count: 10 });
    expect(r.perTopic).toEqual({ A: 7, B: 3 });
    expect(r.shortBy).toBe(0);
  });
  it("never picks from unchosen topics", () => {
    const r = pickQuestions(pool, { topicIds: ["B"], count: 5 });
    expect(r.ids.every((id) => id.startsWith("b"))).toBe(true);
    expect(r.shortBy).toBe(2);
  });
  it("honours the difficulty filter", () => {
    const r = pickQuestions(pool, { topicIds: ["A"], count: 10, difficulties: ["easy"] });
    expect(r.ids).toHaveLength(5);
    expect(r.ids.every((id) => Number(id.slice(1)) % 2 === 1)).toBe(true);
  });
});
