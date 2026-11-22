import type { Metadata } from "next";
import { requireStaffPage } from "@/lib/auth/session";
import { AUTHOR_ROLES } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadSubjects, loadTopics } from "@/lib/questions/repo";
import { questionPool, sittingPlan } from "@/lib/assessments/service";
import { SittingBuilder } from "./sitting-builder";
import { PageHeader } from "@/components/ui/card";
import { Builder } from "./builder";

export const metadata: Metadata = { title: "New test" };

export default async function NewAssessmentPage({ searchParams }: PageProps<"/inst/assessments/new">) {
  const staff = await requireStaffPage(AUTHOR_ROLES);
  const k = (await searchParams).kind;
  const kind = k === "mock" ? "mock" : k === "jamb_full" ? "jamb_full" : "topic_test";
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
  if (kind === "jamb_full") {
    const plan = await sittingPlan(staff, ["all"]);
    const takers = new Map(plan.needed.map((s) => [s.id, s.takers]));
    const published = new Map<string, number>();
    for (const s of plan.subjects) published.set(s.id, (await questionPool(staff, s.id)).length);
    return (
      <>
        <PageHeader eyebrow="Tests" title="New full JAMB mock" />
        <SittingBuilder
          subjects={plan.subjects.map((s) => ({ id: s.id, name: s.name, published: published.get(s.id) ?? 0, takers: takers.get(s.id) ?? 0, english: s.id === plan.english?.id }))
            .sort((a, b) => (a.english ? -1 : b.english ? 1 : a.name.localeCompare(b.name)))}
          students={plan.students}
          ready={plan.ready}
          classes={classes ?? []}
        />
      </>
    );
  }
  return (
    <>
      <PageHeader eyebrow="Tests" title={kind === "mock" ? "New mock" : "New topic test"} />
      <Builder
        key={kind}
        kind={kind as "mock" | "topic_test"}
        subjects={subjects.map((s) => ({ id: s.id, name: s.name, code: s.code, exam_code: s.exam_code }))}
        topics={topics.filter((t) => !t.parent_topic_id).map((t) => ({ id: t.id, subject_id: t.subject_id, name: t.name, published: counts.get(t.id) ?? 0 }))}
        classes={classes ?? []}
      />
    </>
  );
}
