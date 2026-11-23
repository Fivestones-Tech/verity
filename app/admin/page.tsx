import type { Metadata } from "next";
import Link from "next/link";
import { requirePlatformAdminPage } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { activePassesFor } from "@/lib/entitlements/access";
import { onlineCentreCode } from "@/lib/billing/online-centre";
import { EARLY_ACCESS, naira } from "@/lib/billing/plans";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Centres & passes" };

export default async function AdminHome() {
  await requirePlatformAdminPage();
  // Platform admin view: service role after the admin check above.
  const admin = createSupabaseAdminClient();
  const [{ data: centres }, { data: students }] = await Promise.all([
    admin.from("institutions").select("id, name, code, status").order("name").limit(500),
    admin.from("students").select("id, institution_id").eq("status", "active").limit(20000),
  ]);
  const passes = await activePassesFor((students ?? []).map((s) => s.id));
  const totals = new Map<string, { students: number; passes: number }>();
  for (const s of students ?? []) {
    const t = totals.get(s.institution_id) ?? { students: 0, passes: 0 };
    t.students += 1;
    if (passes.has(s.id)) t.passes += 1;
    totals.set(s.institution_id, t);
  }
  const online = onlineCentreCode();
  // Money in: online payments confirmed by Paystack, plus centre cash recorded here.
  const { data: passRows } = await admin.from("student_passes").select("source, amount_kobo").eq("status", "active").limit(50000);
  const sum = (src: string) => (passRows ?? []).filter((p) => p.source === src);
  const money = [
    { label: "Paid online", rows: sum("online_payment") },
    { label: "Centre cash", rows: sum("centre_cash") },
    { label: "Free (pilot)", rows: sum("free_pilot") },
  ].map((m) => ({ label: m.label, count: m.rows.length, kobo: m.rows.reduce((t, p) => t + p.amount_kobo, 0) }));
  const { data: recent } = await admin
    .from("payments")
    .select("id, reference, amount_kobo, status, created_at, student:students(full_name)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <>
      <PageHeader eyebrow="Verity team" title="Centres & passes" />
      <p className="mb-5 max-w-2xl text-sm text-lo">
        When a centre pays you cash for its students ({naira(EARLY_ACCESS.plans.early_access_centre.amountKobo)} each), open the centre and turn their passes on.
        Students who join on their own pay {naira(EARLY_ACCESS.plans.early_access_solo.amountKobo)} online, and their pass turns on by itself.
      </p>
      <div className="mb-6 grid gap-3 grid-cols-2 lg:grid-cols-4">
        {money.map((m) => (
          <Card key={m.label}>
            <p className="eyebrow">{m.label}</p>
            <p className="num mt-1 text-2xl">{naira(m.kobo)}</p>
            <p className="text-sm text-lo">{m.count} pass{m.count === 1 ? "" : "es"}</p>
          </Card>
        ))}
        <Card>
          <p className="eyebrow">Total</p>
          <p className="num mt-1 text-2xl">{naira(money.reduce((t, m) => t + m.kobo, 0))}</p>
          <p className="text-sm text-lo">{money.reduce((t, m) => t + m.count, 0)} passes</p>
        </Card>
      </div>

      <h2 className="eyebrow mb-2">Centres</h2>
      {(centres ?? []).length === 0 ? (
        <EmptyState title="No centres yet" body="Centres appear here once they register." />
      ) : (
        <div className="overflow-x-auto">
          <table className="grid-table text-sm">
            <thead><tr><th>Centre</th><th>Code</th><th className="text-right">Students</th><th className="text-right">With a pass</th></tr></thead>
            <tbody>
              {(centres ?? []).map((c) => {
                const t = totals.get(c.id) ?? { students: 0, passes: 0 };
                return (
                  <tr key={c.id}>
                    <td><Link className="hover:underline" href={`/admin/centres/${c.id}`}>{c.name}</Link>{c.code === online ? " · online centre" : ""}</td>
                    <td className="num">{c.code}</td>
                    <td className="n">{t.students}</td>
                    <td className="n">{t.passes}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="eyebrow mb-2 mt-8">Latest online payments</h2>
      {(recent ?? []).length === 0 ? (
        <p className="text-sm text-lo">No online payments yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="grid-table text-sm">
            <thead><tr><th>Student</th><th className="text-right">Amount</th><th>Status</th><th>When</th><th>Reference</th></tr></thead>
            <tbody>
              {((recent ?? []) as unknown as { id: string; reference: string; amount_kobo: number; status: string; created_at: string; student: { full_name: string } | null }[]).map((p) => (
                <tr key={p.id}>
                  <td>{p.student?.full_name ?? "—"}</td>
                  <td className="n">{naira(p.amount_kobo)}</td>
                  <td>{STATUS[p.status] ?? p.status}</td>
                  <td className="num">{formatDateTime(p.created_at)}</td>
                  <td className="num text-xs">{p.reference}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

const STATUS: Record<string, string> = { success: "Paid", pending: "Not finished", failed: "Failed", abandoned: "Left before paying" };
