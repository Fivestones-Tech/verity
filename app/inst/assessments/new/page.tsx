import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { AUTHOR_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadSubjects, loadTopics } from "@/lib/questions/repo";
import { questionPool } from "@/lib/assessments/service";
import { PageHeader } from "@/components/ui/card";
import { Builder } from "./builder";

export const metadata: Metadata = { title: "New topic test" };

export default async function NewAssessmentPage() {
  const staff = await requireStaffPage(AUTHOR_ROLES);
  const subjects = await loadSubjects(staff.institution.exam_focus);
  const topics = await loadTopics(staff.institution.id, subjects.map((s) => s.id));
  const parentOf = new Map(topics.map((t) => [t.id, t.parent_topic_id]));
  const counts = new Map<string, number>();
  for (const s of subjects) {
    for (const q of await questionPool(staff, s.id)) {
      const top = parentOf.get(q.topic_id) ?? q.topic_id; // count subtopic questions under their topic
      counts.set(top, (counts.get(top) ?? 0) + 1);
    }
  }
  const supabase = await createSupabaseServerClient();
  const { data: classes } = await supabase.from("classes").select("id, name").eq("institution_id", staff.institution.id).eq("status", "active").order("name");
  return (
    <>
      <PageHeader eyebrow="Tests" title="New topic test" />
      <Builder
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, exam_code: s.exam_code }))}
        topics={topics.filter((t) => !t.parent_topic_id).map((t) => ({ id: t.id, subject_id: t.subject_id, name: t.name, published: counts.get(t.id) ?? 0 }))}
        classes={classes ?? []}
      />
    </>
  );
}
