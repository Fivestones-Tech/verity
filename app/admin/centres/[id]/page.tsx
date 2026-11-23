import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requirePlatformAdminPage } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { activePassesFor } from "@/lib/entitlements/access";
import { EARLY_ACCESS, naira } from "@/lib/billing/plans";
import { PageHeader } from "@/components/ui/card";
import { GrantForm } from "./grant-form";

export const metadata: Metadata = { title: "Centre passes" };

export default async function AdminCentrePage({ params }: PageProps<"/admin/centres/[id]">) {
  await requirePlatformAdminPage();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const admin = createSupabaseAdminClient();
  const { data: centre } = await admin.from("institutions").select("id, name, code").eq("id", id).maybeSingle();
  if (!centre) notFound();
  const { data: students } = await admin
    .from("students")
    .select("id, full_name, student_number")
    .eq("institution_id", id)
    .eq("status", "active")
    .order("full_name")
    .limit(2000);
  const passes = await activePassesFor((students ?? []).map((s) => s.id));
  const rows = (students ?? []).map((s) => ({ ...s, pass: passes.get(s.id) ?? null }));
  const without = rows.filter((r) => !r.pass).length;

  return (
    <>
      <PageHeader eyebrow={`Centre code ${centre.code}`} title={centre.name} />
      <p className="mb-5 max-w-2xl text-sm text-lo">
        {rows.length - without} of {rows.length} students have a pass. A pass lasts one year from today and covers JAMB and WAEC.
        Record cash only after the centre has paid you ({naira(EARLY_ACCESS.plans.early_access_centre.amountKobo)} a student).
      </p>
      <GrantForm institutionId={centre.id} students={rows} withoutPass={without} />
    </>
  );
}
