"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeStaff, AuthError } from "@/lib/auth/session";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { DomainError } from "@/lib/api";
import { addStaffMember, createClass, setClassTeacher } from "@/lib/staff/service";

export type SimpleState = { error: string | null; done?: string; password?: string };

function msg(e: unknown) {
  if (e instanceof AuthError || e instanceof DomainError) return e.message;
  console.error("[classes/staff] action failed", e);
  return "Something went wrong. Please try again.";
}

export async function createClassAction(_p: SimpleState, form: FormData): Promise<SimpleState> {
  const name = String(form.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 1 || name.length > 60) return { error: "Give the class a name (up to 60 characters)." };
  try {
    await createClass(await authorizeStaff(MANAGER_ROLES), name);
  } catch (e) {
    return { error: msg(e) };
  }
  revalidatePath("/inst/classes");
  return { error: null, done: `Created ${name}.` };
}

export async function toggleTeacherAction(form: FormData) {
  const staff = await authorizeStaff(MANAGER_ROLES);
  await setClassTeacher(staff, String(form.get("class_id")), String(form.get("user_id")), form.get("assign") === "1");
  revalidatePath("/inst/classes");
}

const staffSchema = z.object({ full_name: z.string().trim().min(2).max(120), email: z.email(), role: z.enum(["admin", "teacher"]) });

export async function addStaffAction(_p: SimpleState, form: FormData): Promise<SimpleState> {
  const p = staffSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Enter a name, a valid email and a role." };
  try {
    const password = await addStaffMember(await authorizeStaff(MANAGER_ROLES), p.data);
    revalidatePath("/inst/staff");
    return { error: null, done: `${p.data.full_name} can now sign in with ${p.data.email}.`, password };
  } catch (e) {
    return { error: msg(e) };
  }
}
