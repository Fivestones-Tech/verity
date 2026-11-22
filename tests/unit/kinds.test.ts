import { describe, expect, it } from "vitest";
import { kindLabel, mockDefaults } from "@/lib/assessments/kinds";
import { createAssessmentSchema } from "@/lib/validation/assessment";

describe("mock defaults follow the real papers", () => {
  it.each([
    ["JAMB", "ENG", 60, 40],
    ["JAMB", "MTH", 40, 30],
    ["JAMB", "LIT", 40, 30],
    ["WAEC", "ENG", 50, 60],
    ["WAEC", "PHY", 50, 60],
  ])("%s %s → %i questions, %i min", (exam, subject, q, m) => {
    expect(mockDefaults(exam, subject)).toEqual({ questions: q, minutes: m });
  });
});

describe("test kinds", () => {
  const base = { name: "Maths", subject_id: "00000000-0000-4000-8000-000000000000", question_count: 10, duration_minutes: 10, assign_to: ["all"] };
  it("a topic test needs topics, a mock does not", () => {
    expect(createAssessmentSchema.safeParse({ ...base, kind: "topic_test", topic_ids: [] }).success).toBe(false);
    expect(createAssessmentSchema.safeParse({ ...base, kind: "mock" }).success).toBe(true);
  });
  it("labels", () => {
    expect(kindLabel("mock")).toBe("mock");
    expect(kindLabel("topic_test")).toBe("topic test");
    expect(kindLabel(undefined)).toBe("test");
  });
});
