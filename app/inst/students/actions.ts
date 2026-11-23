"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorizeStaff, AuthError } from "@/lib/auth/session";
import { MANAGER_ROLES } from "@/lib/auth/roles";
import { DomainError } from "@/lib/api";
import { normaliseStudentNumber } from "@/lib/auth/student-login";
import { addStudent, importStudents, moveStudentToClass, previewStudents, resetStudentPassword, setStudentSubjects } from "@/lib/students/service";
import type { Slip } from "@/components/institution/login-slips";
import { decideJoinRequest } from "@/lib/students/join-requests";

function msg(e: unknown) {
  if (e instanceof AuthError || e instanceof DomainError) return e.message;
  console.error("[students] action failed", e);
  return "Something went wrong. Please try again.";
}

function fileFrom(form: FormData) {
  const f = form.get("file");
  return f instanceof File && f.size > 0 ? f : null;
}

export async function previewStudentImport(form: FormData) {
  try {
    const staff = await authorizeStaff(MANAGER_ROLES);
    const f = fileFrom(form);
    if (!f) return { ok: false as const, message: "Choose a CSV file first." };
    return { ok: true as const, preview: await previewStudents(staff, f) };
  } catch (e) {
    return { ok: false as const, message: msg(e) };
  }
}

export async function commitStudentImport(form: FormData) {
  try {
    const staff = await authorizeStaff(MANAGER_ROLES);
    const f = fileFrom(form);
    if (!f) return { ok: false as const, message: "Choose a CSV file first." };
    const r = await importStudents(staff, f);
    revalidatePath("/inst/students");
    return r;
  } catch (e) {
    return { ok: false as const, message: msg(e) };
  }
}

export type SlipState = { error: string | null; slips?: Slip[] };

const addSchema = z.object({
  full_name: z.string().trim().min(2).max(120),
  student_number: z.string().trim().min(1).max(40),
  class_id: z.uuid().optional().or(z.literal("")),
});

export async function addStudentAction(_prev: SlipState, form: FormData): Promise<SlipState> {
  const p = addSchema.safeParse(Object.fromEntries(form));
  if (!p.success) return { error: "Enter the student's name and student number." };
  const number = normaliseStudentNumber(p.data.student_number);
  if (!/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(number)) return { error: "Student numbers can only use letters, numbers, dots, dashes and slashes." };
  try {
    const staff = await authorizeStaff(MANAGER_ROLES);
    const password = await addStudent(staff, { full_name: p.data.full_name, student_number: number, class_id: p.data.class_id || null });
    revalidatePath("/inst/students");
    return { error: null, slips: [{ full_name: p.data.full_name, student_number: number, class_name: null, password }] };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function resetPasswordAction(_prev: SlipState, form: FormData): Promise<SlipState> {
  try {
    const staff = await authorizeStaff(MANAGER_ROLES);
    const r = await resetStudentPassword(staff, String(form.get("student_id") ?? ""));
    return { error: null, slips: [{ ...r, class_name: null }] };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function moveClassAction(form: FormData) {
  const staff = await authorizeStaff(MANAGER_ROLES);
  const classId = String(form.get("class_id") ?? "") || null;
  await moveStudentToClass(staff, String(form.get("student_id") ?? ""), classId);
  revalidatePath("/inst/students");
}

export type SubjectsState = { error: string | null; saved?: boolean };

export async function setSubjectsAction(_prev: SubjectsState, form: FormData): Promise<SubjectsState> {
  try {
    const staff = await authorizeStaff(MANAGER_ROLES);
    const ids = form.getAll("subject_id").map(String).filter(Boolean);
    await setStudentSubjects(staff, String(form.get("student_id") ?? ""), ids);
    revalidatePath("/inst/students");
    return { error: null, saved: true };
  } catch (e) {
    return { error: msg(e) };
  }
}

export async function joinRequestAction(form: FormData) {
  const staff = await authorizeStaff(MANAGER_ROLES).catch(() => null);
  if (!staff) return;
  const id = z.uuid().safeParse(form.get("student_id"));
  if (!id.success) return;
  try {
    await decideJoinRequest(staff, id.data, form.get("decision") === "accept");
  } catch (e) {
    msg(e);
  }
  revalidatePath("/inst/students");
}
