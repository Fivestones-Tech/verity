/**
 * Deterministic, server-side scoring (docs/08 scoring pipeline).
 * Pure function: given the answer key and the student's responses, returns the result.
 */

export type KeyedQuestion = {
  question_id: string;
  topic_id: string;
  points: number;
  correct_option_id: string;
  /** every option id that legitimately belongs to the question */
  option_ids: string[];
};

export type ScoredQuestion = {
  question_id: string;
  selected_option_id: string | null;
  is_correct: boolean;
  points_awarded: number;
};

export type TopicResult = {
  topic_id: string;
  questions_total: number;
  questions_attempted: number;
  correct_answers: number;
  /** percentage of the topic's questions answered correctly (unanswered count as wrong) */
  percentage: number;
};

export type ScoreResult = {
  score: number;
  max_score: number;
  percentage: number;
  correct_count: number;
  incorrect_count: number;
  unanswered_count: number;
  questions: ScoredQuestion[];
  topics: TopicResult[];
};

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function scoreAttempt(
  key: KeyedQuestion[],
  selections: Map<string, string | null>,
): ScoreResult {
  let score = 0;
  let max = 0;
  let correct = 0;
  let incorrect = 0;
  let unanswered = 0;
  const questions: ScoredQuestion[] = [];
  const topics = new Map<string, TopicResult>();

  for (const q of key) {
    max += q.points;
    const raw = selections.get(q.question_id) ?? null;
    // An option id that does not belong to this question is treated as no answer.
    const selected = raw && q.option_ids.includes(raw) ? raw : null;
    const isCorrect = selected !== null && selected === q.correct_option_id;
    const awarded = isCorrect ? q.points : 0;
    score += awarded;
    if (selected === null) unanswered++;
    else if (isCorrect) correct++;
    else incorrect++;
    questions.push({ question_id: q.question_id, selected_option_id: selected, is_correct: isCorrect, points_awarded: awarded });

    const t = topics.get(q.topic_id) ?? {
      topic_id: q.topic_id,
      questions_total: 0,
      questions_attempted: 0,
      correct_answers: 0,
      percentage: 0,
    };
    t.questions_total++;
    if (selected !== null) t.questions_attempted++;
    if (isCorrect) t.correct_answers++;
    topics.set(q.topic_id, t);
  }

  for (const t of topics.values()) {
    t.percentage = t.questions_total ? round1((t.correct_answers / t.questions_total) * 100) : 0;
  }

  return {
    score,
    max_score: max,
    percentage: max ? round1((score / max) * 100) : 0,
    correct_count: correct,
    incorrect_count: incorrect,
    unanswered_count: unanswered,
    questions,
    topics: [...topics.values()],
  };
}
