import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Overview" };

export default async function InstitutionHome() {
  const staff = await requireStaffPage();
  const supabase = await createSupabaseServerClient();
  const inst = staff.institution.id;
  const head = { count: "exact" as const, head: true };
  const [students, published, review, mine, tests] = await Promise.all([
    supabase.from("students").select("id", head).eq("institution_id", inst).eq("status", "active"),
    supabase.from("questions").select("id", head).eq("institution_id", inst).eq("status", "published"),
    supabase.from("questions").select("id", head).eq("institution_id", inst).eq("status", "review").neq("created_by", staff.userId),
    supabase.from("questions").select("id", head).eq("institution_id", inst).eq("status", "draft"),
    supabase.from("assessments").select("id, name, status, created_at").eq("institution_id", inst).order("created_at", { ascending: false }).limit(5),
  ]);

  const steps = [
    { done: (students.count ?? 0) > 0, label: "Add your students", href: "/inst/students/import" },
    { done: (published.count ?? 0) + (review.count ?? 0) > 0, label: "Import your teachers' questions", href: "/inst/questions/import" },
    { done: (published.count ?? 0) > 0, label: "Review and publish questions", href: "/inst/questions/review" },
    { done: (tests.data ?? []).length > 0, label: "Create your first topic test", href: "/inst/assessments/new" },
  ];
  const next = steps.find((s) => !s.done);

  return (
    <>
      <PageHeader eyebrow={`Centre code ${staff.institution.code}`} title={staff.institution.name} />
      {next && (
        <Card className="mb-6">
          <p className="eyebrow mb-2">Getting started</p>
          <ol className="space-y-2">
            {steps.map((s, i) => (
              <li key={s.label} className="flex items-center gap-3">
                <span className={`num inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs ${s.done ? "border-pine bg-pine text-ink-hi" : "border-paper-line"}`}>{s.done ? "✓" : i + 1}</span>
                {s.done ? <span className="text-lo line-through">{s.label}</span> : <Link href={s.href} className="underline">{s.label}</Link>}
              </li>
            ))}
          </ol>
          <div className="mt-4"><ButtonLink href={next.href} variant="gold">{next.label}</ButtonLink></div>
        </Card>
      )}

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-paper-line bg-paper-line sm:grid-cols-4">
        {[
          ["Students", students.count ?? 0, "/inst/students"],
          ["Published questions", published.count ?? 0, "/inst/questions?status=published"],
          ["Waiting for your review", review.count ?? 0, "/inst/questions/review"],
          ["Sent back to authors", mine.count ?? 0, "/inst/questions?status=draft"],
        ].map(([k, v, href]) => (
          <Link key={String(k)} href={String(href)} className="bg-paper-soft p-3 hover:bg-paper">
            <p className="eyebrow">{k}</p>
            <p className="num mt-1 text-2xl">{v}</p>
          </Link>
        ))}
      </div>

      <Card>
        <div className="mb-2 flex items-center justify-between">
          <p className="eyebrow">Recent tests</p>
          <Link href="/inst/assessments/new" className="text-sm text-pine underline">New topic test</Link>
        </div>
        {(tests.data ?? []).length === 0 ? (
          <p className="text-lo">No tests yet.</p>
        ) : (
          <ul className="divide-y divide-paper-line">
            {(tests.data ?? []).map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2">
                <Link href={`/inst/assessments/${t.id}`} className="hover:underline">{t.name}</Link>
                <StatusBadge status={t.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
