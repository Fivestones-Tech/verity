import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { AUTHOR_ROLES } from "@/lib/auth/roles";
import { PageHeader } from "@/components/ui/card";
import { ImportFlow } from "./import-flow";

export const metadata: Metadata = { title: "Import questions" };

export default async function ImportQuestionsPage() {
  await requireStaffPage(AUTHOR_ROLES);
  return (
    <>
      <PageHeader eyebrow="Question bank" title="Import questions" />
      <ImportFlow />
    </>
  );
}
