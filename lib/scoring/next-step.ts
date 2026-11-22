/**
 * One clear next step after a test (docs/08 result screen, docs/16).
 * Rule-based and deterministic (docs/23 D6). The full recommendation engine from
 * docs/07 comes with the readiness work; this is the pilot's simple version.
 */

export type TopicScore = { topic_id: string; name: string; percentage: number; questions_total: number };

export type NextStep = {
  kind: "practice_topic" | "time_management" | "move_on";
  title: string;
  reason: string;
  topic_id: string | null;
};

export const NEEDS_ATTENTION_BELOW = 50;
export const STRONG_FROM = 70;

/** docs/07 minimum evidence rule: no Good/Strong label on fewer than ~5 questions. */
export const MIN_EVIDENCE = 5;

export type Band = "needs_attention" | "developing" | "good" | "strong" | "not_enough_evidence";

/** Band for one test's topic result (labels from docs/07). */
export function topicBand(pct: number, questions: number): Band {
  if (questions < MIN_EVIDENCE) return "not_enough_evidence";
  if (pct < 50) return "needs_attention";
  if (pct < 65) return "developing";
  if (pct < 80) return "good";
  return "strong";
}

export function nextStep(args: {
  topics: TopicScore[];
  unansweredCount: number;
  totalQuestions: number;
  autoSubmitted: boolean;
}): NextStep {
  const { topics, unansweredCount, totalQuestions, autoSubmitted } = args;

  // Ran out of time with many blanks: time is the problem, not (only) knowledge.
  if (autoSubmitted && totalQuestions > 0 && unansweredCount / totalQuestions >= 0.2) {
    return {
      kind: "time_management",
      title: "Practise answering under time",
      reason: `Time ran out with ${unansweredCount} of ${totalQuestions} questions unanswered.`,
      topic_id: null,
    };
  }

  // Weakest topic first; ties broken by more questions (stronger evidence), then name.
  const sorted = [...topics].sort(
    (a, b) => a.percentage - b.percentage || b.questions_total - a.questions_total || a.name.localeCompare(b.name),
  );
  const weakest = sorted[0];
  if (weakest && weakest.percentage < STRONG_FROM) {
    return {
      kind: "practice_topic",
      title: `Practise ${weakest.name}`,
      reason: `You scored ${Math.round(weakest.percentage)}% on ${weakest.name} in this test.`,
      topic_id: weakest.topic_id,
    };
  }
  return {
    kind: "move_on",
    title: "Move on to the next topic",
    reason: "You scored 70% or more on every topic in this test.",
    topic_id: null,
  };
}
