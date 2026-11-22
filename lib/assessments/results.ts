import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { closeStaleAttempts } from "@/lib/attempts/service";
import { round1 } from "@/lib/scoring/score";

/**
 * Teacher view of one test. Every read goes through the user's RLS client, so a
 * teacher only ever sees students in their own classes (admins see everyone).
 */
export async function loadAssessmentResults(assessmentId: string) {
  const supabase = await createSupabaseServerClient();
  const { data: a } = await supabase
    .from("assessments")
    .select("id, name, assessment_type, status, duration_seconds, created_at, start_at, end_at, institution_id, subject:subjects(name), assignments:assessment_assignments(class_id, student_id)")
    .eq("id", assessmentId)
    .maybeSingle();
  if (!a) return null;
  await closeStaleAttempts({ assessmentId });

  type Asg = { class_id: string | null; student_id: string | null };
  const asg = (a.assignments ?? []) as Asg[];
  const everyone = asg.some((x) => !x.class_id && !x.student_id);
  let sq = supabase.from("students").select("id, full_name, student_number, class_id").eq("institution_id", a.institution_id).eq("status", "active").order("full_name");
  if (!everyone) {
    const classIds = asg.map((x) => x.class_id).filter(Boolean) as string[];
    const studentIds = asg.map((x) => x.student_id).filter(Boolean) as string[];
    const parts = [classIds.length ? `class_id.in.(${classIds.join(",")})` : "", studentIds.length ? `id.in.(${studentIds.join(",")})` : ""].filter(Boolean);
    sq = sq.or(parts.join(","));
  }
  const [{ data: students }, { data: attempts }, { data: aq }, { data: classes }] = await Promise.all([
    sq,
    supabase
      .from("assessment_attempts")
      .select("id, student_id, status, score, max_score, percentage, correct_count, incorrect_count, unanswered_count, time_used_seconds, started_at, expires_at, submitted_at, synced_late")
      .eq("assessment_id", assessmentId),
    supabase.from("assessment_questions").select("question_id, position, question:questions(question_text, topic:topics(id, name))").eq("assessment_id", assessmentId).order("position"),
    supabase.from("classes").select("id, name").eq("institution_id", a.institution_id),
  ]);

  const attemptIds = (attempts ?? []).filter((x) => x.status !== "in_progress").map((x) => x.id);
  const [{ data: tp }, { data: resp }] = attemptIds.length
    ? await Promise.all([
        supabase.from("topic_performance").select("topic_id, questions_total, correct_answers, attempt_id").in("attempt_id", attemptIds),
        supabase.from("responses").select("question_id, is_correct, selected_option_id").in("attempt_id", attemptIds),
      ])
    : [{ data: [] }, { data: [] }];

  type AQ = { question_id: string; position: number; question: { question_text: string; topic: { id: string; name: string } | null } | null };
  const aqs = (aq ?? []) as unknown as AQ[];
  const topicName = new Map<string, string>();
  for (const q of aqs) if (q.question?.topic) topicName.set(q.question.topic.id, q.question.topic.name);

  // Topic averages: pooled correct / total across submitted attempts
  const topicAgg = new Map<string, { total: number; correct: number }>();
  for (const t of tp ?? []) {
    const g = topicAgg.get(t.topic_id) ?? { total: 0, correct: 0 };
    g.total += t.questions_total;
    g.correct += t.correct_answers;
    topicAgg.set(t.topic_id, g);
  }
  const missingNames = [...topicAgg.keys()].filter((id) => !topicName.has(id));
  if (missingNames.length) {
    const { data: tn } = await supabase.from("topics").select("id, name").in("id", missingNames);
    for (const t of tn ?? []) topicName.set(t.id, t.name);
  }
  const topics = [...topicAgg.entries()]
    .map(([id, g]) => ({ topic_id: id, name: topicName.get(id) ?? "Topic", percentage: g.total ? round1((g.correct / g.total) * 100) : 0, questions: g.total }))
    .sort((x, y) => x.percentage - y.percentage);

  // Most missed questions
  const qAgg = new Map<string, { seen: number; wrong: number }>();
  for (const r of resp ?? []) {
    const g = qAgg.get(r.question_id) ?? { seen: 0, wrong: 0 };
    g.seen++;
    if (!r.is_correct) g.wrong++;
    qAgg.set(r.question_id, g);
  }
  const mostMissed = aqs
    .map((q) => ({ question_id: q.question_id, text: q.question?.question_text ?? "", topic: q.question?.topic?.name ?? "", ...(qAgg.get(q.question_id) ?? { seen: 0, wrong: 0 }) }))
    .filter((q) => q.seen > 0)
    .sort((x, y) => y.wrong / y.seen - x.wrong / x.seen)
    .slice(0, 5);

  const byStudent = new Map((attempts ?? []).map((x) => [x.student_id, x]));
  const className = new Map((classes ?? []).map((c) => [c.id, c.name]));
  const rows = (students ?? []).map((s) => ({
    student: { ...s, class_name: className.get(s.class_id ?? "") ?? null },
    attempt: byStudent.get(s.id) ?? null,
  }));
  const done = rows.filter((r) => r.attempt && r.attempt.status !== "in_progress");
  const avg = done.length ? round1(done.reduce((n, r) => n + Number(r.attempt!.percentage ?? 0), 0) / done.length) : null;

  return {
    assessment: a as typeof a & { subject: { name: string } | null },
    questionCount: aqs.length,
    rows,
    stats: {
      assigned: rows.length,
      submitted: done.length,
      inProgress: rows.filter((r) => r.attempt?.status === "in_progress").length,
      notStarted: rows.filter((r) => !r.attempt).length,
      average: avg,
    },
    topics,
    mostMissed,
  };
}
