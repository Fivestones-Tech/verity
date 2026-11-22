import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudentPage } from "@/lib/auth/session";
import { loadStudentResult } from "@/lib/student/results";
import { formatDateTime, formatDuration } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Stamp } from "@/components/ui/stamp";
import { TopicBar } from "@/components/ui/topic-bar";

export const metadata: Metadata = { title: "Your result" };

export default async function ResultPage({ params }: PageProps<"/app/results/[attemptId]">) {
  const ctx = await requireStudentPage();
  const { attemptId } = await params;
  const r = await loadStudentResult(ctx, attemptId);
  if (!r) notFound();
  const { attempt: a, topics, step } = r;

  if (a.status === "in_progress") {
    return (
      <Card>
        <p className="eyebrow">Not submitted yet</p>
        <p className="mt-2">This test is still open on your device.</p>
        <div className="mt-4"><ButtonLink href={`/app/assessments/${a.assessment_id}/take`} variant="gold">Resume</ButtonLink></div>
      </Card>
    );
  }
  const wrong = (a.incorrect_count ?? 0) + (a.unanswered_count ?? 0);

  return (
    <div className="mx-auto max-w-xl space-y-5">
      {/* Result slip: document-style card (docs/10) */}
      <section className="relative rounded-[3px] border border-paper-line bg-paper-soft p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow">Result slip · <span className="num">{a.id.slice(0, 8).toUpperCase()}</span></p>
            <h1 className="mt-1 font-serif text-2xl">{a.assessment?.name}</h1>
            <p className="text-sm text-lo">{a.assessment?.subject?.name}</p>
          </div>
          <Stamp tone={a.status === "auto_submitted" ? "gold" : "pine"}>{a.status === "auto_submitted" ? "Time up" : "Submitted"}</Stamp>
        </div>
        <div className="doc-rule my-4" />
        <p className="num text-5xl font-semibold">{Math.round(Number(a.percentage))}%</p>
        <p className="num mt-1 text-lo">{Number(a.score)} / {Number(a.max_score)} marks</p>
        <dl className="mt-4 grid grid-cols-4 gap-2 text-center">
          {[
            ["Correct", a.correct_count],
            ["Wrong", a.incorrect_count],
            ["Blank", a.unanswered_count],
            ["Time", formatDuration(a.time_used_seconds)],
          ].map(([k, v]) => (
            <div key={String(k)} className="rounded-[3px] border border-paper-line p-2">
              <dt className="eyebrow">{k}</dt>
              <dd className="num mt-1 text-lg">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="doc-rule my-4" />
        <p className="eyebrow mb-1">Topics</p>
        {topics.map((t) => (
          <TopicBar key={t.topic_id} name={t.name} percentage={t.percentage} questions={t.questions_total} detail={`${t.correct_answers}/${t.questions_total} correct`} />
        ))}
        <p className="num mt-3 text-xs text-lo">Submitted {formatDateTime(a.submitted_at)}{a.synced_late ? " · answers reached Verity after the timer ended" : ""}</p>
      </section>

      {step && (
        <Card>
          <p className="eyebrow">Your next step</p>
          <p className="mt-1 font-serif text-xl">{step.title}</p>
          <p className="mt-1 text-sm text-lo">Why: {step.reason}</p>
          {wrong > 0 && <div className="mt-4"><ButtonLink href={`/app/results/${a.id}/review`} variant="gold">Review your mistakes</ButtonLink></div>}
        </Card>
      )}
      <Link href="/app" className="inline-block text-sm underline">Back to my tests</Link>
    </div>
  );
}
