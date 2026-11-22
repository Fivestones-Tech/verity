import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/card";
import { StudentImportFlow } from "./student-import-flow";

export const metadata: Metadata = { title: "Import students" };

export default async function ImportStudentsPage() {
  const staff = await requireStaffPage(MANAGER_ROLES);
  return (
    <>
      <PageHeader eyebrow="Students" title="Import students" />
      <StudentImportFlow centreCode={staff.institution.code} centreName={staff.institution.name} />
    </>
  );
}
