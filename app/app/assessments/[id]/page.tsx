import type { Metadata } from "next";
import { testLabel } from "@/lib/assessments/kinds";
import { notFound } from "next/navigation";
import { requireStudentPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Before you start" };

export default async function InstructionsPage({ params }: PageProps<"/app/assessments/[id]">) {
  const ctx = await requireStudentPage();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  // RLS: only returns the test if it is assigned to this student
  const { data: t } = await supabase
    .from("assessments")
    .select("id, name, assessment_type, format, status, duration_seconds, end_at, instructions, attempt_limit, subject:subjects(name), question_count")
    .eq("id", id)
    .maybeSingle();
  if (!t) notFound();
  const { data: att } = await supabase.from("assessment_attempts").select("id, status").eq("assessment_id", id).eq("student_id", ctx.student.id).limit(1).maybeSingle();
  type T = typeof t & { subject: { name: string } | null; question_count: number; format: string };
  const a = t as unknown as T;
  const count = a.question_count;
  // A full JAMB mock needs the student's 3 subjects (RLS: a student reads their own)
  const { count: mySubjects } = a.format === "jamb_utme"
    ? await supabase.from("student_subjects").select("subject_id", { count: "exact", head: true }).eq("student_id", ctx.student.id)
    : { count: null };
  const subjectsMissing = a.format === "jamb_utme" && (mySubjects ?? 0) !== 3;

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">{a.subject?.name ?? "English + your 3 subjects"} · {testLabel(a.assessment_type, a.format)}</p>
      <h1 className="mt-1 font-serif text-3xl">{a.name}</h1>
      <Card className="mt-5">
        <dl className="grid grid-cols-2 gap-y-3">
          <dt className="eyebrow">Questions</dt><dd className="num">{count}</dd>
          <dt className="eyebrow">Time allowed</dt><dd className="num">{Math.round(a.duration_seconds / 60)} min</dd>
          <dt className="eyebrow">Attempts</dt><dd>{a.attempt_limit === 1 ? "One attempt" : `${a.attempt_limit} attempts`}</dd>
          {a.end_at && <><dt className="eyebrow">Closes</dt><dd className="num">{formatDateTime(a.end_at)}</dd></>}
        </dl>
        {a.instructions && <p className="doc-rule mt-4 pt-4 whitespace-pre-wrap">{a.instructions}</p>}
      </Card>
      <ul className="mt-5 list-disc space-y-1 pl-5 text-sm text-lo">
        <li>The timer starts when you press Begin and keeps running even if you close the page.</li>
        <li>Each answer is saved on your phone first. If the internet drops, keep going. Your answers send when you’re back online.</li>
        <li>When time runs out, your answers are submitted automatically.</li>
      </ul>
      <div className="mt-6">
        {att?.status === "in_progress" ? (
          <ButtonLink href={`/app/assessments/${a.id}/take`} variant="gold">Resume</ButtonLink>
        ) : att ? (
          <ButtonLink href={`/app/results/${att.id}`}>See your result</ButtonLink>
        ) : a.status !== "active" ? (
          <p className="text-lo">This test is closed.</p>
        ) : subjectsMissing ? (
          <p className="text-lo">Your JAMB subjects aren’t set yet. Please ask your teacher to add them, then come back.</p>
        ) : (
          <ButtonLink href={`/app/assessments/${a.id}/take`} variant="gold">Begin</ButtonLink>
        )}
      </div>
    </div>
  );
}
