import "server-only";
import type { StaffContext } from "@/lib/auth/session";
import { loadSubjects, loadTopics } from "@/lib/questions/repo";

/** Subjects and topics for the question form, scoped to the caller's centre. */
export async function questionFormData(staff: StaffContext) {
  const subjects = await loadSubjects(staff.institution.exam_focus);
  const topics = await loadTopics(staff.institution.id, subjects.map((s) => s.id));
  const nameById = new Map(topics.map((t) => [t.id, t.name]));
  return {
    subjects: subjects.map((s) => ({ id: s.id, name: s.name, exam_code: s.exam_code })),
    topics: topics.map((t) => ({ id: t.id, subject_id: t.subject_id, name: t.name, parent_name: t.parent_topic_id ? nameById.get(t.parent_topic_id) ?? null : null })),
  };
}
