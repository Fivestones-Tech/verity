import { normaliseStudentNumber } from "@/lib/auth/student-login";
import { parseSubjectCell, type RefSubjectLite } from "@/lib/students/subjects";

/**
 * Student CSV: full_name, student_number, class (optional), subjects (optional:
 * the 3 JAMB subjects besides English, e.g. "Physics; Chemistry; Biology"). Pure validation.
 */
export const STUDENT_COLUMNS = ["full_name", "student_number", "class", "subjects"] as const;
export const MAX_STUDENT_ROWS = 1000;

export type StudentRow = { rowNumber: number; full_name: string; student_number: string; class_name: string | null; subject_ids: string[] };
export type StudentRowError = { rowNumber: number; errors: string[]; preview: string };
export type StudentPreview = {
  headerErrors: string[];
  valid: StudentRow[];
  invalid: StudentRowError[];
  newClasses: string[];
  totalRows: number;
};

export function validateStudents(args: {
  fields: string[];
  rows: Record<string, unknown>[];
  existingNumbers: Set<string>;
  existingClasses: string[];
  /** JAMB subjects, for the optional "subjects" column */
  subjects?: RefSubjectLite[];
}): StudentPreview {
  const out: StudentPreview = { headerErrors: [], valid: [], invalid: [], newClasses: [], totalRows: args.rows.length };
  const have = new Set(args.fields.map((f) => f.trim().toLowerCase()));
  const missing = ["full_name", "student_number"].filter((c) => !have.has(c));
  if (missing.length) {
    out.headerErrors.push(`Missing column(s): ${missing.join(", ")}. Download the template and keep its header row.`);
    return out;
  }
  if (args.rows.length > MAX_STUDENT_ROWS) {
    out.headerErrors.push(`This file has ${args.rows.length} rows. Please split it into files of ${MAX_STUDENT_ROWS} or fewer.`);
    return out;
  }
  const seen = new Map<string, number>();
  const classLower = new Map(args.existingClasses.map((c) => [c.toLowerCase(), c]));
  const newClasses = new Map<string, string>();

  args.rows.forEach((raw, i) => {
    const rowNumber = i + 2;
    const get = (k: string) => {
      const v = raw[k];
      return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
    };
    const errors: string[] = [];
    const name = get("full_name").replace(/\s+/g, " ");
    const number = normaliseStudentNumber(get("student_number"));
    const cls = get("class").replace(/\s+/g, " ") || null;
    if (name.length < 2) errors.push("full_name is empty");
    if (name.length > 120) errors.push("full_name is too long");
    if (!number) errors.push("student_number is empty");
    else if (!/^[A-Z0-9][A-Z0-9._/-]{0,39}$/.test(number)) {
      errors.push("student_number can only use letters, numbers, dots, dashes and slashes");
    }
    if (number && args.existingNumbers.has(number)) errors.push(`student number ${number} is already registered at your centre`);
    if (number && seen.has(number)) errors.push(`duplicate of row ${seen.get(number)} in this file`);
    else if (number) seen.set(number, rowNumber);
    if (cls && cls.length > 60) errors.push("class name is too long");
    const subj = parseSubjectCell(get("subjects"), args.subjects ?? []);
    errors.push(...subj.errors);

    if (errors.length) {
      out.invalid.push({ rowNumber, errors, preview: name || number });
      return;
    }
    let className: string | null = null;
    if (cls) {
      className = classLower.get(cls.toLowerCase()) ?? newClasses.get(cls.toLowerCase()) ?? cls;
      if (!classLower.has(cls.toLowerCase())) newClasses.set(cls.toLowerCase(), className);
    }
    out.valid.push({ rowNumber, full_name: name, student_number: number, class_name: className, subject_ids: subj.ids });
  });
  out.newClasses = [...newClasses.values()];
  return out;
}
