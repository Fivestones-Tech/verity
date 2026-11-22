/**
 * JAMB-style scores for a full sitting: each subject is marked out of 100 and the
 * four add up to a total out of 400. Pure and deterministic (docs/07: code computes
 * scores, never AI). Unanswered questions score zero.
 */
export type SubjectQuestion = { subject_id: string; is_correct: boolean };
export type SubjectScore = { subject_id: string; correct: number; total: number; score: number };

export function jambScores(questions: SubjectQuestion[], subjectOrder: string[]): { subjects: SubjectScore[]; total: number; max: number } {
  const by = new Map<string, { correct: number; total: number }>();
  for (const q of questions) {
    const s = by.get(q.subject_id) ?? { correct: 0, total: 0 };
    s.total += 1;
    if (q.is_correct) s.correct += 1;
    by.set(q.subject_id, s);
  }
  const order = [...subjectOrder.filter((id) => by.has(id)), ...[...by.keys()].filter((id) => !subjectOrder.includes(id))];
  const subjects = order.map((id) => {
    const s = by.get(id)!;
    return { subject_id: id, correct: s.correct, total: s.total, score: s.total ? Math.round((s.correct / s.total) * 100) : 0 };
  });
  return { subjects, total: subjects.reduce((n, s) => n + s.score, 0), max: subjects.length * 100 };
}

/** English first, then the student's other subjects in name order: the JAMB screen order. */
export function sittingSubjectOrder(subjects: { id: string; name: string; code: string }[]): string[] {
  return [...subjects]
    .sort((a, b) => (a.code === "ENG" ? -1 : b.code === "ENG" ? 1 : a.name.localeCompare(b.name)))
    .map((s) => s.id);
}
