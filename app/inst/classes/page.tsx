import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { hasAnyRole, MANAGER_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { CreateClassForm } from "./forms";
import { toggleTeacherAction } from "./actions";

export const metadata: Metadata = { title: "Classes" };

export default async function ClassesPage() {
  const staff = await requireStaffPage();
  const canManage = hasAnyRole(staff.roles, MANAGER_ROLES);
  const supabase = await createSupabaseServerClient();
  const [{ data: classes }, { data: students }, { data: teachers }, { data: links }] = await Promise.all([
    supabase.from("classes").select("id, name").eq("institution_id", staff.institution.id).eq("status", "active").order("name"),
    supabase.from("students").select("class_id").eq("institution_id", staff.institution.id).eq("status", "active"),
    supabase.from("institution_memberships").select("user_id, role, profile:profiles(full_name)").eq("institution_id", staff.institution.id).eq("status", "active").in("role", ["teacher", "tutor", "staff"]),
    supabase.from("class_teachers").select("class_id, user_id"),
  ]);
  const counts = new Map<string, number>();
  for (const s of students ?? []) if (s.class_id) counts.set(s.class_id, (counts.get(s.class_id) ?? 0) + 1);
  type T = { user_id: string; role: string; profile: { full_name: string } | null };
  const teacherList = (teachers ?? []) as unknown as T[];

  return (
    <>
      <PageHeader eyebrow={staff.institution.name} title="Classes" />
      {canManage && <Card className="mb-6"><CreateClassForm /></Card>}
      {(classes ?? []).length === 0 ? (
        <EmptyState title="No classes yet" body="Create classes such as “JAMB Batch A”, or add a class column when you import students." />
      ) : (
        <div className="space-y-3">
          {(classes ?? []).map((c) => {
            const assigned = new Set((links ?? []).filter((l) => l.class_id === c.id).map((l) => l.user_id));
            return (
              <Card key={c.id}>
                <div className="flex items-baseline justify-between">
                  <h2 className="font-serif text-xl">{c.name}</h2>
                  <span className="text-sm text-lo"><span className="num">{counts.get(c.id) ?? 0}</span> students</span>
                </div>
                {canManage && teacherList.length > 0 && (
                  <div className="mt-3">
                    <p className="eyebrow mb-1">Teachers (they see this class’s students and results)</p>
                    <div className="flex flex-wrap gap-2">
                      {teacherList.map((t) => (
                        <form key={t.user_id} action={toggleTeacherAction}>
                          <input type="hidden" name="class_id" value={c.id} />
                          <input type="hidden" name="user_id" value={t.user_id} />
                          <input type="hidden" name="assign" value={assigned.has(t.user_id) ? "0" : "1"} />
                          <button aria-pressed={assigned.has(t.user_id)} className={`min-h-9 rounded-full border px-3 text-sm ${assigned.has(t.user_id) ? "border-pine bg-pine text-ink-hi" : "border-paper-line"}`}>
                            {assigned.has(t.user_id) ? "✓ " : "+ "}{t.profile?.full_name || "Teacher"}
                          </button>
                        </form>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {canManage && <p className="mt-4 text-sm text-lo">Owners and admins see every class. Teachers see only the classes they are added to.</p>}
    </>
  );
}
