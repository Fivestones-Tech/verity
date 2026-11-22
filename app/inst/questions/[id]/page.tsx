import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/lib/auth/session";
import { hasAnyRole, AUTHOR_ROLES } from "@/lib/auth/roles";
import { loadQuestion } from "@/lib/questions/load";
import { questionFormData } from "@/lib/questions/form-data";
import { Notice, PageHeader } from "@/components/ui/card";
import { QuestionCard } from "@/components/institution/question-card";
import { QuestionForm } from "../question-form";
import { archiveAction } from "../actions";

export const metadata: Metadata = { title: "Question" };

export default async function QuestionPage({ params, searchParams }: PageProps<"/inst/questions/[id]">) {
  const staff = await requireStaffPage();
  const { id } = await params;
  const sp = await searchParams;
  const q = await loadQuestion(id);
  if (!q) notFound();
  const canEdit = hasAnyRole(staff.roles, AUTHOR_ROLES) && q.status !== "archived";
  const editing = sp.edit === "1" && canEdit;

  if (editing) {
    const { subjects, topics } = await questionFormData(staff);
    const opt = Object.fromEntries(q.options.map((o) => [o.option_key, o.option_text])) as { A: string; B: string; C: string; D: string };
    return (
      <>
        <PageHeader eyebrow="Question bank" title="Edit question" />
        {q.status === "published" && <div className="mb-4"><Notice>This question is live. Saving a change takes it out of new tests until another teacher approves it again. Tests already taken keep their results.</Notice></div>}
        <QuestionForm
          subjects={subjects}
          topics={topics}
          defaults={{
            id: q.id, subject_id: q.subject_id, topic_id: q.topic_id, question_text: q.question_text, options: opt,
            correct_option: q.options.find((o) => o.is_correct)?.option_key, difficulty: q.difficulty, explanation: q.explanation ?? "", source: q.source,
          }}
        />
      </>
    );
  }

  return (
    <>
      <PageHeader eyebrow="Question bank" title="Question" />
      <div className="space-y-4">
        {sp.saved === "1" && <Notice tone="success">Saved. The question is now waiting for another teacher to review it.</Notice>}
        {q.status === "draft" && q.review_note && <Notice>Sent back by the reviewer: “{q.review_note}”. Edit it to send it for review again.</Notice>}
        <QuestionCard q={q} />
        {canEdit && (
          <div className="flex flex-wrap gap-4">
            <a href={`?edit=1`} className="inline-flex min-h-11 items-center rounded-full bg-pine px-5 font-mono text-xs uppercase text-ink-hi">Edit</a>
            <form action={archiveAction}>
              <input type="hidden" name="question_id" value={q.id} />
              <button className="min-h-11 text-sm text-lo underline">Archive (remove from new tests)</button>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
