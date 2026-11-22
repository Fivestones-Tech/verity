import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { testLabel } from "@/lib/assessments/kinds";

export const metadata: Metadata = { title: "Tests" };

export default async function AssessmentsPage() {
  const staff = await requireStaffPage();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("assessments")
    .select("id, name, assessment_type, format, status, duration_seconds, created_at, subject:subjects(name), questions:assessment_questions(count), attempts:assessment_attempts(count)")
    .eq("institution_id", staff.institution.id)
    .order("created_at", { ascending: false })
    .limit(100);
  type R = { id: string; name: string; assessment_type: string; format: string; status: string; duration_seconds: number; created_at: string; subject: { name: string } | null; questions: { count: number }[]; attempts: { count: number }[] };
  const rows = (data ?? []) as unknown as R[];
  return (
    <>
      <PageHeader eyebrow={staff.institution.name} title="Tests">
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/inst/assessments/new" variant="gold">New topic test</ButtonLink>
          <ButtonLink href="/inst/assessments/new?kind=mock" variant="ghost">New mock</ButtonLink>
          <ButtonLink href="/inst/assessments/new?kind=jamb_full" variant="ghost">New full JAMB mock</ButtonLink>
        </div>
      </PageHeader>
      {rows.length === 0 ? (
        <EmptyState title="No tests yet" body="Create a timed topic test from your published questions. Students see it as soon as you open it." action={<ButtonLink href="/inst/assessments/new">New topic test</ButtonLink>} />
      ) : (
        <div className="overflow-x-auto">
          <table className="grid-table text-sm">
            <thead><tr><th>Test</th><th>Type</th><th>Subject</th><th className="text-right">Questions</th><th className="text-right">Minutes</th><th className="text-right">Taken</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/inst/assessments/${r.id}`} className="font-medium hover:underline">{r.name}</Link></td>
                  <td className="capitalize">{testLabel(r.assessment_type, r.format)}</td>
                  <td>{r.subject?.name ?? "English + 3 subjects"}</td>
                  <td className="n">{r.questions[0]?.count ?? 0}</td>
                  <td className="n">{Math.round(r.duration_seconds / 60)}</td>
                  <td className="n">{r.attempts[0]?.count ?? 0}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
