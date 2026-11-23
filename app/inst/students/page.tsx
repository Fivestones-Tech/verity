import type { Metadata } from "next";
import Link from "next/link";
import { requireStaffPage } from "@/lib/auth/session";
import { hasAnyRole, MANAGER_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ButtonLink } from "@/components/ui/button";
import { Card, EmptyState, Notice, PageHeader } from "@/components/ui/card";
import { SelectField } from "@/components/ui/field";
import { AddStudentForm, ResetPasswordButton, SubjectsForm } from "./student-forms";
import { jambSubjects } from "@/lib/students/service";
import { joinRequestAction, moveClassAction } from "./actions";
import { listJoinRequests } from "@/lib/students/join-requests";
import { activePass } from "@/lib/entitlements/pass";
import { formatDay } from "@/lib/student/pass";
import { EARLY_ACCESS, naira } from "@/lib/billing/plans";

export const metadata: Metadata = { title: "Students" };
const PER_PAGE = 50;

export default async function StudentsPage({ searchParams }: PageProps<"/inst/students">) {
  const staff = await requireStaffPage();
  const canManage = hasAnyRole(staff.roles, MANAGER_ROLES);
  const sp = await searchParams;
  const classFilter = typeof sp.class === "string" ? sp.class : "";
  const search = typeof sp.q === "string" ? sp.q.trim().slice(0, 60) : "";
  const page = Math.max(1, Number(sp.page) || 1);

  // RLS: admins see the whole centre, teachers see students in their classes.
  const supabase = await createSupabaseServerClient();
  const { data: classes } = await supabase.from("classes").select("id, name").eq("institution_id", staff.institution.id).eq("status", "active").order("name");
  let q = supabase
    .from("students")
    .select("id, full_name, student_number, class_id, status", { count: "exact" })
    .eq("institution_id", staff.institution.id)
    .order("full_name")
    .range((page - 1) * PER_PAGE, page * PER_PAGE - 1);
  if (classFilter) q = q.eq("class_id", classFilter);
  if (search) q = q.or(`full_name.ilike.%${search.replace(/[%,()]/g, "")}%,student_number.ilike.%${search.replace(/[%,()]/g, "")}%`);
  const { data: students, count, error } = await q;
  const className = new Map((classes ?? []).map((c) => [c.id, c.name]));
  // JAMB subject combinations (English is compulsory, so only the other 3 are listed)
  const subjectList = (await jambSubjects(staff)).filter((s) => s.code !== "ENG").sort((a, b) => a.name.localeCompare(b.name));
  const subjectName = new Map(subjectList.map((s) => [s.id, s.name]));
  const ids = (students ?? []).map((s) => s.id);
  const { data: ss } = ids.length ? await supabase.from("student_subjects").select("student_id, subject_id").in("student_id", ids) : { data: [] };
  const subjectsOf = new Map<string, string[]>();
  for (const r of ss ?? []) subjectsOf.set(r.student_id, [...(subjectsOf.get(r.student_id) ?? []), r.subject_id]);
  const showSubjects = subjectList.length > 0;
  // Early Access passes, read through RLS (staff see passes of students they can see)
  const { data: passRows } = ids.length ? await supabase.from("student_passes").select("student_id, status, starts_at, ends_at").in("student_id", ids) : { data: [] };
  const passOf = new Map<string, string>();
  for (const id of ids) {
    const p = activePass((passRows ?? []).filter((r) => r.student_id === id));
    if (p) passOf.set(id, p.ends_at);
  }
  const total = count ?? 0;
  const joinRequests = canManage ? await listJoinRequests(staff) : [];

  return (
    <>
      <PageHeader eyebrow={staff.institution.name} title="Students">
        {canManage && <ButtonLink href="/inst/students/import">Import CSV</ButtonLink>}
      </PageHeader>
      <p className="mb-5 text-sm text-lo">
        Students sign in with centre code <span className="num font-semibold text-hi">{staff.institution.code}</span>, their student number and password.
        {" "}Each student’s first test in one subject is free. For a full year of practice, collect the {naira(EARLY_ACCESS.plans.early_access_centre.amountKobo)} Early Access pass from each student and pay Verity; we then turn their passes on.
      </p>

      {joinRequests.length > 0 && (
        <Card className="mb-6 border-gold">
          <p className="eyebrow mb-1">Asking to join your centre</p>
          <p className="mb-3 text-sm text-lo">These students created their own account and typed your centre code. Accept only students you know. They pay Verity online themselves, or you can collect the pass money from them.</p>
          <ul className="space-y-2">
            {joinRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>{r.full_name}{r.email ? <span className="text-sm text-lo"> · {r.email}</span> : null}</span>
                <form action={joinRequestAction} className="flex gap-2">
                  <input type="hidden" name="student_id" value={r.id} />
                  <button name="decision" value="accept" className="min-h-11 rounded-full bg-pine px-4 font-mono text-xs uppercase text-ink-hi">Accept</button>
                  <button name="decision" value="decline" className="min-h-11 rounded-full border border-paper-line px-4 font-mono text-xs uppercase">Decline</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {canManage && (
        <Card className="mb-6">
          <p className="eyebrow mb-3">Add one student</p>
          <AddStudentForm classes={classes ?? []} centreCode={staff.institution.code} centreName={staff.institution.name} />
        </Card>
      )}

      <form className="mb-4 grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="q" className="eyebrow mb-1.5 block">Search</label>
          <input id="q" name="q" defaultValue={search} placeholder="Name or student number" className="block w-full min-h-11 rounded-[3px] border border-paper-line bg-paper px-3" />
        </div>
        <SelectField label="Class" id="class" defaultValue={classFilter}>
          <option value="">All classes</option>
          {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <button className="min-h-11 rounded-full border border-paper-line px-5 font-mono text-xs uppercase">Filter</button>
      </form>

      {error && <Notice tone="error">We couldn’t load students. Please refresh the page.</Notice>}
      {!error && (students ?? []).length === 0 ? (
        <EmptyState
          title={search || classFilter ? "No students match" : "No students yet"}
          body={canManage ? "Import your students from a spreadsheet to create their sign-in details." : "Students in the classes you teach will appear here."}
          action={canManage && !search && !classFilter ? <ButtonLink href="/inst/students/import">Import CSV</ButtonLink> : undefined}
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="grid-table text-sm">
            <thead><tr><th>Name</th><th>Student no.</th><th>Class</th>{showSubjects && <th>JAMB subjects (with English)</th>}<th>Pass</th>{canManage && <th>Sign-in</th>}</tr></thead>
            <tbody>
              {(students ?? []).map((s) => (
                <tr key={s.id}>
                  <td>{s.full_name}</td>
                  <td className="num">{s.student_number}</td>
                  <td>
                    {canManage ? (
                      <form action={moveClassAction} className="flex gap-2">
                        <input type="hidden" name="student_id" value={s.id} />
                        <select name="class_id" defaultValue={s.class_id ?? ""} aria-label={`Class for ${s.full_name}`} className="min-h-9 rounded-[3px] border border-paper-line bg-paper px-2">
                          <option value="">No class</option>
                          {(classes ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button className="font-mono text-xs uppercase text-pine">Save</button>
                      </form>
                    ) : (
                      className.get(s.class_id ?? "") ?? "—"
                    )}
                  </td>
                  {showSubjects && (
                    <td>
                      {canManage ? (
                        <SubjectsForm studentId={s.id} studentName={s.full_name} subjects={subjectList} current={(subjectsOf.get(s.id) ?? []).sort((a, b) => (subjectName.get(a) ?? "").localeCompare(subjectName.get(b) ?? ""))} />
                      ) : (
                        (subjectsOf.get(s.id) ?? []).map((id) => subjectName.get(id)).sort().join(", ") || "Not set"
                      )}
                    </td>
                  )}
                  <td className="whitespace-nowrap">{passOf.has(s.id) ? `Until ${formatDay(passOf.get(s.id)!)}` : <span className="text-lo">Free trial</span>}</td>
                  {canManage && <td><ResetPasswordButton studentId={s.id} centreCode={staff.institution.code} centreName={staff.institution.name} /></td>}
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
            {page > 1 && <Link className="underline" href={`?page=${page - 1}&class=${classFilter}&q=${encodeURIComponent(search)}`}>Previous</Link>}
            {page * PER_PAGE < total && <Link className="underline" href={`?page=${page + 1}&class=${classFilter}&q=${encodeURIComponent(search)}`}>Next</Link>}
          </span>
        </div>
      )}
    </>
  );
}
