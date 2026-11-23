import { currentUserIsPlatformAdmin, requireStaffPage } from "@/lib/auth/session";
import { hasAnyRole, MANAGER_ROLES } from "@/lib/auth/roles";
import { AppShell } from "@/components/shared/app-shell";

export default async function InstitutionLayout({ children }: LayoutProps<"/inst">) {
  const staff = await requireStaffPage();
  const links = [
    { href: "/inst", label: "Overview" },
    { href: "/inst/assessments", label: "Tests" },
    { href: "/inst/questions", label: "Questions" },
    { href: "/inst/questions/review", label: "Review" },
    { href: "/inst/students", label: "Students" },
    { href: "/inst/classes", label: "Classes" },
    ...(hasAnyRole(staff.roles, MANAGER_ROLES) ? [{ href: "/inst/staff", label: "Staff" }] : []),
    ...((await currentUserIsPlatformAdmin()) ? [{ href: "/admin", label: "Verity admin" }] : []),
  ];
  return (
    <AppShell links={links} who={`${staff.fullName} · ${staff.institution.name}`}>
      {children}
    </AppShell>
  );
}
