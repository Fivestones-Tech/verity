"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorizeStaff, AuthError } from "@/lib/auth/session";
import { AUTHOR_ROLES } from "@/lib/auth/roles";
import { DomainError } from "@/lib/api";
import { createAssessmentSchema } from "@/lib/validation/assessment";
import { createTopicTest, setAssessmentStatus } from "@/lib/assessments/service";

export type BuilderState = { error: string | null };

export async function createAssessmentAction(_p: BuilderState, form: FormData): Promise<BuilderState> {
  const parsed = createAssessmentSchema.safeParse({
    name: form.get("name"),
    subject_id: form.get("subject_id"),
    topic_ids: form.getAll("topic_ids"),
    question_count: form.get("question_count"),
    duration_minutes: form.get("duration_minutes"),
    difficulties: form.getAll("difficulties"),
    assign_to: form.getAll("assign_to"),
    open_now: form.get("open_now") === "1",
    end_at: (form.get("end_at_iso") as string) || undefined,
    instructions: (form.get("instructions") as string) || undefined,
  });
  if (!parsed.success) {
    const path = String(parsed.error.issues[0]?.path[0] ?? "");
    const hints: Record<string, string> = {
      name: "Give the test a name.",
      topic_ids: "Choose at least one topic.",
      assign_to: "Choose who should take the test.",
      question_count: "Number of questions must be between 1 and 200.",
      duration_minutes: "Time allowed must be between 1 and 240 minutes.",
    };
    return { error: hints[path] ?? "Please check the form." };
  }
  let id: string;
  try {
    id = await createTopicTest(await authorizeStaff(AUTHOR_ROLES), parsed.data);
  } catch (e) {
    if (e instanceof AuthError || e instanceof DomainError) return { error: e.message };
    console.error("[assessments] create failed", e);
    return { error: "We couldn't create the test. Please try again." };
  }
  revalidatePath("/inst/assessments");
  redirect(`/inst/assessments/${id}?created=1`);
}

export async function setStatusAction(form: FormData) {
  const id = String(form.get("assessment_id") ?? "");
  const status = form.get("status") === "active" ? "active" : "completed";
  await setAssessmentStatus(await authorizeStaff(AUTHOR_ROLES), id, status);
  revalidatePath(`/inst/assessments/${id}`);
  redirect(`/inst/assessments/${id}`);
}
