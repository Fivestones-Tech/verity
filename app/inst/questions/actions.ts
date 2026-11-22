"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { authorizeStaff, AuthError } from "@/lib/auth/session";
import { AUTHOR_ROLES, REVIEWER_ROLES } from "@/lib/auth/roles";
import { DomainError } from "@/lib/api";
import { questionFormSchema, reviewSchema } from "@/lib/validation/question";
import { archiveQuestion, reviewQuestion, saveQuestion } from "@/lib/questions/edit-service";

export type FormState = { error: string | null; fieldErrors?: Record<string, string> };

function safeMessage(e: unknown) {
  if (e instanceof AuthError || e instanceof DomainError) return e.message;
  console.error("[questions] action failed", e);
  return "Something went wrong. Please try again.";
}

export async function saveQuestionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = questionFormSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { error: "Please check the highlighted fields.", fieldErrors };
  }
  const id = (form.get("question_id") as string) || null;
  let savedId: string;
  try {
    const staff = await authorizeStaff(AUTHOR_ROLES);
    savedId = await saveQuestion(staff, parsed.data, id);
  } catch (e) {
    return { error: safeMessage(e) };
  }
  revalidatePath("/inst/questions");
  redirect(`/inst/questions/${savedId}?saved=1`);
}

export async function reviewAction(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = reviewSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Please choose approve or send back." };
  if (parsed.data.decision === "send_back" && !parsed.data.note) {
    return { error: "Tell the author what to fix before sending it back." };
  }
  try {
    const staff = await authorizeStaff(REVIEWER_ROLES);
    await reviewQuestion(staff, parsed.data.question_id, parsed.data.decision, parsed.data.note);
  } catch (e) {
    return { error: safeMessage(e) };
  }
  revalidatePath("/inst/questions");
  redirect("/inst/questions/review");
}

export async function archiveAction(form: FormData) {
  const id = String(form.get("question_id") ?? "");
  const staff = await authorizeStaff(AUTHOR_ROLES);
  await archiveQuestion(staff, id);
  revalidatePath("/inst/questions");
  redirect(`/inst/questions/${id}`);
}
