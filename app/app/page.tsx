import type { Metadata } from "next";
import Link from "next/link";
import { requireStudentPage } from "@/lib/auth/session";
import { loadStudentHome } from "@/lib/student/home";
import { formatDateTime, pct } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, Notice } from "@/components/ui/card";
import { LocalProgressNotice } from "@/components/student/local-progress-notice";
import { formatDay, loadPassSummary } from "@/lib/student/pass";

export const metadata: Metadata = { title: "My tests" };

export default async function StudentHome() {
  const ctx = await requireStudentPage();
  const [tests, pass] = await Promise.all([loadStudentHome(ctx), loadPassSummary(ctx)]);
  const inProgress = tests.filter((t) => t.attempt?.status === "in_progress");
  const toTake = tests.filter((t) => !t.attempt && t.status === "active" && (!t.end_at || new Date(t.end_at) > new Date()));
  const done = tests.filter((t) => t.attempt && t.attempt.status !== "in_progress");
  const first = ctx.student.full_name.split(" ")[0];

  return (
    <>
      <h1 className="mb-1 font-serif text-3xl">Hello, {first}</h1>
      <p className="mb-6 text-lo">Your centre’s tests are below. Each one shows your score and the topics to work on.</p>
      <LocalProgressNotice />

      {pass.pendingCentreName && (
        <div className="mb-4">
          <Notice>Waiting for {pass.pendingCentreName} to accept you. Their tests will appear here once they do.</Notice>
        </div>
      )}

      {pass.pass ? (
        <p className="mb-4 text-sm text-lo">
          <span className="font-medium text-pine">Early Access pass active</span> until {formatDay(pass.pass.ends_at)}.
        </p>
      ) : (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">{pass.trialUsed ? "Free test used" : "Free trial"}</p>
              <p className="mt-1 text-sm">
                {pass.trialUsed
                  ? `Get the Early Access pass (${pass.price}) for a full year of JAMB and WAEC practice.`
                  : `Your first test in one subject is free. After that, the Early Access pass is ${pass.price} for a full year.`}
              </p>
            </div>
            <ButtonLink href="/app/pass" variant={pass.trialUsed ? "gold" : "ghost"}>See the pass</ButtonLink>
          </div>
        </Card>
      )}

      {inProgress.map((t) => (
        <Card key={t.id} className="mb-4 border-gold">
          <p className="eyebrow">In progress</p>
          <p className="mt-1 font-serif text-xl">{t.name}</p>
          <div className="mt-3"><ButtonLink href={`/app/assessments/${t.id}/take`} variant="gold">Resume test</ButtonLink></div>
        </Card>
      ))}

      <section className="mb-8">
        <h2 className="eyebrow mb-2">To take</h2>
        {toTake.length === 0 ? (
          <EmptyState title="No tests waiting" body="When your teacher opens a test for you, it will appear here." />
        ) : (
          <ul className="space-y-3">
            {toTake.map((t, i) => (
              <li key={t.id}>
                <Card>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="num text-sm text-lo">{t.format === "jamb_utme" ? "English + your 3 subjects · full JAMB mock" : `${t.subject?.name ?? ""}${t.assessment_type === "mock" ? " · mock" : ""}`} · {t.questionCount} questions · {Math.round(t.duration_seconds / 60)} min{t.end_at ? ` · closes ${formatDateTime(t.end_at)}` : ""}</p>
                    </div>
                    <ButtonLink href={`/app/assessments/${t.id}`} variant={i === 0 ? "gold" : "primary"}>Start</ButtonLink>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="eyebrow mb-2">Results</h2>
          <div className="overflow-x-auto">
            <table className="grid-table text-sm">
              <thead><tr><th>Test</th><th className="text-right">Score</th><th>When</th></tr></thead>
              <tbody>
                {done.map((t) => (
                  <tr key={t.id}>
                    <td><Link className="hover:underline" href={`/app/results/${t.attempt!.id}`}>{t.name}</Link></td>
                    <td className="n">{pct(t.attempt!.percentage)}</td>
                    <td className="num">{formatDateTime(t.attempt!.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
