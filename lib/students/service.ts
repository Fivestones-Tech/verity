import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import type { StaffContext } from "@/lib/auth/session";
import { DomainError } from "@/lib/api";
import { generatePassword, studentLoginEmail } from "@/lib/auth/student-login";
import { parseCsv } from "@/lib/questions/csv";
import { validateStudents, type StudentPreview } from "@/lib/students/import-validation";
import { checkCombination, type RefSubjectLite } from "@/lib/students/subjects";
import { loadSubjects } from "@/lib/questions/repo";

const domain = () => process.env.STUDENT_LOGIN_DOMAIN ?? "students.verity.invalid";

export type LoginSlip = { full_name: string; student_number: string; class_name: string | null; password: string };

async function refData(institutionId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: students }, { data: classes }] = await Promise.all([
    admin.from("students").select("student_number").eq("institution_id", institutionId),
    admin.from("classes").select("id, name").eq("institution_id", institutionId).eq("status", "active"),
  ]);
  return {
    existingNumbers: new Set((students ?? []).map((s) => s.student_number as string).filter(Boolean)),
    classes: (classes ?? []) as { id: string; name: string }[],
  };
}

export async function previewStudents(staff: StaffContext, file: File): Promise<StudentPreview> {
  if (file.size > 1024 * 1024) {
    return { headerErrors: ["This file is larger than 1 MB. Please split it."], valid: [], invalid: [], newClasses: [], totalRows: 0 };
  }
  const { fields, rows } = parseCsv(await file.text());
  const ref = await refData(staff.institution.id);
  const subjects = await jambSubjects(staff);
  return validateStudents({ fields, rows, existingNumbers: ref.existingNumbers, existingClasses: ref.classes.map((c) => c.name), subjects });
}

/** JAMB subjects (English included, so it can be recognised and dropped). Empty for WAEC-only centres. */
export async function jambSubjects(staff: StaffContext): Promise<RefSubjectLite[]> {
  return (await loadSubjects(staff.institution.exam_focus)).filter((s) => s.exam_code === "JAMB").map((s) => ({ id: s.id, name: s.name, code: s.code }));
}

async function writeSubjects(institutionId: string, studentId: string, subjectIds: string[]) {
  const admin = createSupabaseAdminClient();
  await admin.from("student_subjects").delete().eq("student_id", studentId);
  if (subjectIds.length) {
    const { error } = await admin.from("student_subjects").insert(subjectIds.map((subject_id) => ({ student_id: studentId, subject_id, institution_id: institutionId })));
    if (error) {
      console.error("[students] subjects insert failed", error.message);
      throw new DomainError("subjects_failed", "We couldn't save the subjects. Please try again.", 500);
    }
  }
}

/** Set a student's 3 JAMB subjects (English is always included). */
export async function setStudentSubjects(staff: StaffContext, studentId: string, subjectIds: string[]) {
  const admin = createSupabaseAdminClient();
  const { data: st } = await admin.from("students").select("institution_id").eq("id", studentId).maybeSingle();
  if (!st || st.institution_id !== staff.institution.id) throw new DomainError("student_not_found", "We couldn't find that student.", 404);
  const check = checkCombination(subjectIds, await jambSubjects(staff));
  if (check.errors.length) throw new DomainError("invalid_subjects", `Please ${check.errors[0]}.`);
  await writeSubjects(staff.institution.id, studentId, check.ids);
  await audit({ actorUserId: staff.userId, institutionId: staff.institution.id, action: "student.subjects_set", resourceType: "student", resourceId: studentId, metadata: { subject_ids: check.ids } });
}

async function createStudentAccount(staff: StaffContext, s: { full_name: string; student_number: string; class_id: string | null; subject_ids?: string[] }) {
  const admin = createSupabaseAdminClient();
  const password = generatePassword();
  const { data, error } = await admin.auth.admin.createUser({
    email: studentLoginEmail(staff.institution.code, s.student_number, domain()),
    password,
    email_confirm: true,
    user_metadata: { full_name: s.full_name },
  });
  if (error || !data.user) {
    console.error("[students] createUser failed", error?.status, error?.code);
    return null;
  }
  await admin.from("profiles").update({ full_name: s.full_name }).eq("id", data.user.id);
  const { data: created, error: sErr } = await admin.from("students").insert({
    profile_id: data.user.id,
    institution_id: staff.institution.id,
    full_name: s.full_name,
    student_number: s.student_number,
    class_id: s.class_id,
  }).select("id").single();
  if (sErr || !created) {
    console.error("[students] insert failed", sErr?.message);
    await admin.auth.admin.deleteUser(data.user.id);
    return null;
  }
  if (s.subject_ids?.length) {
    try {
      await writeSubjects(staff.institution.id, created.id, s.subject_ids);
    } catch {
      // the account exists; subjects can be set from the Students page
    }
  }
  return password;
}

export async function importStudents(staff: StaffContext, file: File) {
  const preview = await previewStudents(staff, file);
  if (preview.headerErrors.length) return { ok: false as const, message: preview.headerErrors[0] };
  if (!preview.valid.length) return { ok: false as const, message: "There are no valid students to add." };

  const admin = createSupabaseAdminClient();
  const ref = await refData(staff.institution.id);
  const classId = new Map(ref.classes.map((c) => [c.name.toLowerCase(), c.id]));
  for (const name of preview.newClasses) {
    const { data } = await admin.from("classes").insert({ institution_id: staff.institution.id, name }).select("id").single();
    if (data) classId.set(name.toLowerCase(), data.id);
  }

  const slips: LoginSlip[] = [];
  const failed: string[] = [];
  for (const s of preview.valid) {
    const password = await createStudentAccount(staff, {
      full_name: s.full_name,
      student_number: s.student_number,
      class_id: s.class_name ? classId.get(s.class_name.toLowerCase()) ?? null : null,
      subject_ids: s.subject_ids,
    });
    if (password) slips.push({ full_name: s.full_name, student_number: s.student_number, class_name: s.class_name, password });
    else failed.push(s.student_number);
  }
  await audit({
    actorUserId: staff.userId,
    institutionId: staff.institution.id,
    action: "students.imported",
    resourceType: "student",
    metadata: { added: slips.length, failed: failed.length, skipped: preview.invalid.length },
  });
  return { ok: true as const, slips, failed, skipped: preview.invalid.length };
}

export async function addStudent(staff: StaffContext, s: { full_name: string; student_number: string; class_id: string | null }) {
  const admin = createSupabaseAdminClient();
  if (s.class_id) {
    const { data } = await admin.from("classes").select("institution_id").eq("id", s.class_id).maybeSingle();
    if (!data || data.institution_id !== staff.institution.id) throw new DomainError("invalid_class", "Choose one of your classes.");
  }
  const { data: dup } = await admin
    .from("students")
    .select("id")
    .eq("institution_id", staff.institution.id)
    .eq("student_number", s.student_number)
    .maybeSingle();
  if (dup) throw new DomainError("duplicate_student", `Student number ${s.student_number} is already registered.`);
  const password = await createStudentAccount(staff, s);
  if (!password) throw new DomainError("student_failed", "We couldn't add that student. Please try again.", 500);
  await audit({ actorUserId: staff.userId, institutionId: staff.institution.id, action: "student.added", resourceType: "student", metadata: { student_number: s.student_number } });
  return password;
}

export async function resetStudentPassword(staff: StaffContext, studentId: string) {
  const admin = createSupabaseAdminClient();
  const { data: st } = await admin.from("students").select("id, institution_id, profile_id, full_name, student_number").eq("id", studentId).maybeSingle();
  if (!st || st.institution_id !== staff.institution.id || !st.profile_id) {
    throw new DomainError("student_not_found", "We couldn't find that student.", 404);
  }
  const password = generatePassword();
  const { error } = await admin.auth.admin.updateUserById(st.profile_id, { password });
  if (error) throw new DomainError("reset_failed", "We couldn't reset the password. Please try again.", 500);
  await audit({ actorUserId: staff.userId, institutionId: staff.institution.id, action: "student.password_reset", resourceType: "student", resourceId: st.id });
  return { full_name: st.full_name as string, student_number: st.student_number as string, password };
}

export async function moveStudentToClass(staff: StaffContext, studentId: string, classId: string | null) {
  const admin = createSupabaseAdminClient();
  const { data: st } = await admin.from("students").select("institution_id").eq("id", studentId).maybeSingle();
  if (!st || st.institution_id !== staff.institution.id) throw new DomainError("student_not_found", "We couldn't find that student.", 404);
  if (classId) {
    const { data: c } = await admin.from("classes").select("institution_id").eq("id", classId).maybeSingle();
    if (!c || c.institution_id !== staff.institution.id) throw new DomainError("invalid_class", "Choose one of your classes.");
  }
  await admin.from("students").update({ class_id: classId, updated_at: new Date().toISOString() }).eq("id", studentId);
}
