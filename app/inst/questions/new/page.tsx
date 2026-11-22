import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { AUTHOR_ROLES } from "@/lib/auth/roles";
import { questionFormData } from "@/lib/questions/form-data";
import { PageHeader } from "@/components/ui/card";
import { QuestionForm } from "../question-form";

export const metadata: Metadata = { title: "Add a question" };

export default async function NewQuestionPage() {
  const staff = await requireStaffPage(AUTHOR_ROLES);
  const { subjects, topics } = await questionFormData(staff);
  return (
    <>
      <PageHeader eyebrow="Question bank" title="Add a question" />
      <QuestionForm subjects={subjects} topics={topics} />
    </>
  );
}
