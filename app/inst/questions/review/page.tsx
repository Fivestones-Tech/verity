import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { REVIEWER_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadQuestion } from "@/lib/questions/load";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { QuestionCard } from "@/components/institution/question-card";
import { ReviewActions } from "./review-actions";

export const metadata: Metadata = { title: "Review questions" };

export default async function ReviewPage() {
  const staff = await requireStaffPage(REVIEWER_ROLES);
  const supabase = await createSupabaseServerClient();
  const base = supabase.from("questions").select("id", { count: "exact" }).eq("institution_id", staff.institution.id).eq("status", "review");
  // A person must not approve their own question (docs/18): show others' first.
  const { data: next, count } = await base.neq("created_by", staff.userId).order("created_at").limit(1);
  const { count: mine } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("institution_id", staff.institution.id)
    .eq("status", "review")
    .eq("created_by", staff.userId);

  const q = next?.[0] ? await loadQuestion(next[0].id) : null;

  return (
    <>
      <PageHeader eyebrow="Question bank" title="Review questions" />
      {!q ? (
        <EmptyState
          title="Nothing to review"
          body={
            mine
              ? `${mine} of your own questions are waiting. Another teacher at your centre needs to review those.`
              : "When teachers import or add questions, they appear here for a second teacher to check."
          }
          action={<ButtonLink href="/inst/questions" variant="ghost">Back to questions</ButtonLink>}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-lo">
            <span className="num">{count ?? 0}</span> waiting for you
            {mine ? <> · <span className="num">{mine}</span> of your own need another reviewer</> : null}
          </p>
          <QuestionCard q={q} />
          <ReviewActions key={q.id} questionId={q.id} />
        </div>
      )}
    </>
  );
}
