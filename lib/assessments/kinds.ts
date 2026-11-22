/**
 * Test kinds the pilot builds (docs/08 assessment types).
 *  - topic_test: teacher picks topics.
 *  - mock: one subject paper drawn from the whole syllabus, exam-sized by default.
 * Pure and client-safe.
 */
export type TestKind = "topic_test" | "mock";

export const KIND_LABEL: Record<string, string> = {
  topic_test: "topic test",
  mock: "mock",
  diagnostic: "diagnostic",
  practice: "practice",
  institutional: "test",
};

export function kindLabel(type: string | null | undefined) {
  return KIND_LABEL[type ?? ""] ?? "test";
}

/**
 * Default size and time for a one-subject mock.
 * JAMB UTME: English 60 questions, other subjects 40, 2 hours for 180 questions
 * (about 40 seconds a question), so English 40 min and others 30 min.
 * WAEC objective papers: 50 questions, about an hour.
 * Teachers can change both before creating the mock.
 */
export function mockDefaults(examCode: string, subjectCode: string): { questions: number; minutes: number } {
  if (examCode === "WAEC") return { questions: 50, minutes: 60 };
  if (subjectCode === "ENG") return { questions: 60, minutes: 40 };
  return { questions: 40, minutes: 30 };
}

/** Full JAMB UTME sitting: English plus the student's 3 subjects in one 2-hour sitting. */
export const JAMB_SITTING = { englishQuestions: 60, otherQuestions: 40, minutes: 120, subjectsPerStudent: 3, englishCode: "ENG" } as const;

/** Label shown on screens: a full JAMB sitting reads differently from a one-subject mock. */
export function testLabel(type: string | null | undefined, format?: string | null) {
  return format === "jamb_utme" ? "full JAMB mock" : kindLabel(type);
}
