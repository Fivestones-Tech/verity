import type { Metadata } from "next";
import { kindLabel } from "@/lib/assessments/kinds";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { hasAnyRole, AUTHOR_ROLES } from "@/lib/auth/roles";
import { loadAssessmentResults } from "@/lib/assessments/results";
import { attemptStatusLabel, formatDateTime, formatDuration, pct } from "@/lib/format";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { TopicBar } from "@/components/ui/topic-bar";
import { setStatusAction } from "../actions";

export const metadata: Metadata = { title: "Test results" };

export default async function AssessmentResultsPage({ params, searchParams }: PageProps<"/inst/assessments/[id]">) {
  const staff = await requireStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const r = await loadAssessmentResults(id);
  if (!r) notFound();
  const { assessment: a, stats } = r;
  const canEdit = hasAnyRole(staff.roles, AUTHOR_ROLES);

  return (
    <>
      <PageHeader eyebrow={`${a.subject?.name ?? ""} · ${kindLabel(a.assessment_type)}`} title={a.name}>
        <a href={`/inst/assessments/${a.id}/export`} className="inline-flex min-h-11 items-center rounded-full border border-paper-line px-5 font-mono text-xs uppercase">Download CSV</a>
      </PageHeader>
      {sp.created === "1" && (
        <div className="mb-4">
          <Notice tone="success">{a.status === "active" ? "The test is open. Students will see it on their Verity home screen." : "Saved as a draft. Open it when students should start."}</Notice>
        </div>
      )}

      <div className="mb-5 flex flex-wrap items-center gap-3 text-sm">
        <StatusBadge status={a.status} />
        <span className="num">{r.questionCount} questions · {Math.round(a.duration_seconds / 60)} min</span>
        {a.end_at && <span className="text-lo">Closes {formatDateTime(a.end_at)}</span>}
        {canEdit && (
          <form action={setStatusAction} className="ml-auto">
            <input type="hidden" name="assessment_id" value={a.id} />
            {a.status === "active" ? (
              <button name="status" value="completed" className="min-h-11 text-sm text-lo underline">Close test (no new starts)</button>
            ) : (
              <button name="status" value="active" className="min-h-11 rounded-full bg-pine px-5 font-mono text-xs uppercase text-ink-hi">Open test</button>
            )}
          </form>
        )}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-paper-line bg-paper-line sm:grid-cols-4">
        {[
          ["Submitted", `${stats.submitted} / ${stats.assigned}`],
          ["Taking now", String(stats.inProgress)],
          ["Not started", String(stats.notStarted)],
          ["Average", stats.average == null ? "—" : `${Math.round(stats.average)}%`],
        ].map(([k, v]) => (
          <div key={k} className="bg-paper-soft p-3">
            <p className="eyebrow">{k}</p>
            <p className="num mt-1 text-2xl">{v}</p>
          </div>
        ))}
      </div>

      {stats.submitted === 0 ? (
        <EmptyState title="No results yet" body="Results appear here as soon as students submit. Topic averages and the most-missed questions show once the first student finishes." />
      ) : (
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Card>
            <p className="eyebrow mb-1">Topic averages · weakest first</p>
            {r.topics.map((t) => <TopicBar key={t.topic_id} name={t.name} percentage={t.percentage} questions={t.questions} detail={`${t.questions} answers`} />)}
          </Card>
          <Card>
            <p className="eyebrow mb-2">Most missed questions</p>
            <ol className="space-y-3">
              {r.mostMissed.map((q) => (
                <li key={q.question_id} className="text-sm">
                  <a href={`/inst/questions/${q.question_id}`} className="hover:underline">{q.text.length > 120 ? q.text.slice(0, 120) + "…" : q.text}</a>
                  <p className="text-xs text-lo">{q.topic} · <span className="num">{q.wrong} of {q.seen}</span> got it wrong</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>
      )}

      {r.rows.length === 0 ? (
        <EmptyState title="No students assigned" body="Nobody you can see is assigned to this test. Check the class, or add students to the class." />
      ) : (
        <div className="overflow-x-auto">
          <table className="grid-table text-sm">
            <thead><tr><th>Student</th><th>Class</th><th>Status</th><th className="text-right">Score</th><th className="text-right">%</th><th className="text-right">Blank</th><th className="text-right">Time</th></tr></thead>
            <tbody>
              {r.rows.map(({ student: s, attempt: at }) => (
                <tr key={s.id}>
                  <td>{s.full_name}<div className="num text-xs text-lo">{s.student_number}</div></td>
                  <td>{s.class_name ?? "—"}</td>
                  <td>
                    {attemptStatusLabel(at?.status, at?.synced_late)}
                    {at?.status === "in_progress" && new Date(at.expires_at) < new Date() && <div className="text-xs text-lo">Time is up; waiting for answers saved on their device</div>}
                  </td>
                  <td className="n">{at && at.status !== "in_progress" ? `${Number(at.score)}/${Number(at.max_score)}` : "—"}</td>
                  <td className="n">{at && at.status !== "in_progress" ? pct(at.percentage) : "—"}</td>
                  <td className="n">{at && at.status !== "in_progress" ? at.unanswered_count : "—"}</td>
                  <td className="n">{at && at.status !== "in_progress" ? formatDuration(at.time_used_seconds) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
