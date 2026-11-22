import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadSubjects } from "@/lib/questions/repo";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";

export const metadata: Metadata = { title: "Question bank" };

const PER_PAGE = 50;
const STATUSES = ["review", "published", "draft", "archived"] as const;

export default async function QuestionsPage({ searchParams }: PageProps<"/inst/questions">) {
  const staff = await requireStaffPage();
  const sp = await searchParams;
  const subject = typeof sp.subject === "string" ? sp.subject : "";
  const status = typeof sp.status === "string" && (STATUSES as readonly string[]).includes(sp.status) ? sp.status : "";
  const page = Math.max(1, Number(sp.page) || 1);

  // RLS scopes this to the caller's centre.
  const supabase = await createSupabaseServerClient();
  let q = supabase
    .from("questions")
    .select("id, question_text, difficulty, status, review_note, subject:subjects(name), topic:topics(name)", { count: "exact" })
    .eq("institution_id", staff.institution.id)
    .order("created_at", { ascending: false })
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (subject) q = q.eq("subject_id", subject);
  if (status) q = q.eq("status", status);
  const { data, count, error } = await q;

  const { data: statusRows } = await supabase.from("questions").select("status").eq("institution_id", staff.institution.id);
  const counts = new Map<string, number>();
  for (const r of statusRows ?? []) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
  const subjects = await loadSubjects(staff.institution.exam_focus);

  type Row = { id: string; question_text: string; difficulty: string; status: string; review_note: string | null; subject: { name: string } | null; topic: { name: string } | null };
  const rows = (data ?? []) as unknown as Row[];
  const total = count ?? 0;
  const qs = (p: number) => `?${new URLSearchParams({ ...(subject && { subject }), ...(status && { status }), page: String(p) })}`;

  return (
    <>
      <PageHeader eyebrow="Question bank" title="Questions">
        <ButtonLink href="/inst/questions/import">Import CSV</ButtonLink>
        <ButtonLink href="/inst/questions/new" variant="ghost">Add one</ButtonLink>
      </PageHeader>

      <div className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] border border-paper-line bg-paper-line sm:grid-cols-4">
        {STATUSES.map((s) => (
          <Link key={s} href={`?status=${s}`} className="bg-paper-soft p-3 hover:bg-paper">
            <p className="eyebrow">{s === "review" ? "Waiting for review" : s === "draft" ? "Sent back" : s}</p>
            <p className="num mt-1 text-2xl">{counts.get(s) ?? 0}</p>
          </Link>
        ))}
      </div>

      <form className="mb-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <SelectField label="Subject" id="subject" defaultValue={subject}>
          <option value="">All subjects</option>
          {subjects.map((s) => <option key={s.id} value={s.id}>{s.exam_code} · {s.name}</option>)}
        </SelectField>
        <SelectField label="Status" id="status" defaultValue={status}>
          <option value="">Any status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </SelectField>
        <button className="min-h-11 rounded-full border border-paper-line px-5 font-mono text-xs uppercase">Filter</button>
      </form>

      {error && <Notice tone="error">We couldn’t load questions. Please refresh the page.</Notice>}
      {!error && rows.length === 0 ? (
        <EmptyState
          title={subject || status ? "No questions match" : "No questions yet"}
          body={subject || status ? "Try a different filter." : "Import your teachers' questions from a spreadsheet, or add them one at a time."}
          action={!(subject || status) ? <ButtonLink href="/inst/questions/import">Import CSV</ButtonLink> : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="grid-table text-sm">
            <thead>
              <tr><th>Question</th><th>Subject · topic</th><th>Level</th><th>Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="min-w-[14rem]">
                    <Link href={`/inst/questions/${r.id}`} className="hover:underline">{r.question_text.length > 110 ? r.question_text.slice(0, 110) + "…" : r.question_text}</Link>
                    {r.status === "draft" && r.review_note && <p className="mt-1 text-xs text-lo">Reviewer: {r.review_note}</p>}
                  </td>
                  <td>{r.subject?.name} · {r.topic?.name}</td>
                  <td>{r.difficulty}</td>
                  <td><StatusBadge status={r.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {total > PER_PAGE && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="num text-lo">{(page - 1) * PER_PAGE + 1}–{Math.min(total, page * PER_PAGE)} of {total}</span>
          <span className="flex gap-3">
            {page > 1 && <Link className="underline" href={qs(page - 1)}>Previous</Link>}
            {page * PER_PAGE < total && <Link className="underline" href={qs(page + 1)}>Next</Link>}
          </span>
        </div>
      )}
    </>
  );
}
