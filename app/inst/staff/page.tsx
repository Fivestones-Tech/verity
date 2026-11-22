import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/card";
import { AddStaffForm } from "../classes/forms";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage() {
  const staff = await requireStaffPage(MANAGER_ROLES);
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("institution_memberships")
    .select("id, role, status, profile:profiles(full_name, email)")
    .eq("institution_id", staff.institution.id)
    .order("created_at");
  type M = { id: string; role: string; status: string; profile: { full_name: string; email: string } | null };
  return (
    <>
      <PageHeader eyebrow={staff.institution.name} title="Staff" />
      <Card className="mb-6">
        <p className="eyebrow mb-3">Add a teacher</p>
        <AddStaffForm canAddAdmin={staff.roles.includes("owner")} />
      </Card>
      <div className="overflow-x-auto">
        <table className="grid-table text-sm">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th></tr></thead>
          <tbody>
            {((data ?? []) as unknown as M[]).map((m) => (
              <tr key={m.id}><td>{m.profile?.full_name}</td><td>{m.profile?.email}</td><td>{m.role}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
