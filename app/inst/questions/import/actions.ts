"use server";

import { authorizeStaff, AuthError } from "@/lib/auth/session";
import { AUTHOR_ROLES } from "@/lib/auth/roles";
import { buildPreview, commitImport } from "@/lib/questions/import-service";

export type PreviewResult =
  | { ok: false; message: string }
  | {
      ok: true;
      totalRows: number;
      validCount: number;
      headerErrors: string[];
      parseErrors: string[];
      invalid: { rowNumber: number; errors: string[]; preview: string }[];
      warnings: { rowNumber: number; warnings: string[] }[];
      newTopics: { subject_name: string; name: string; parent: string | null }[];
      bySubject: { subject: string; topic: string; count: number }[];
      sample: { rowNumber: number; question_text: string; correct: string; topic: string; difficulty: string }[];
    };

function fileFrom(form: FormData): File | null {
  const f = form.get("file");
  return f instanceof File && f.size > 0 ? f : null;
}

export async function previewQuestionImport(form: FormData): Promise<PreviewResult> {
  try {
    const staff = await authorizeStaff(AUTHOR_ROLES);
    const file = fileFrom(form);
    if (!file) return { ok: false, message: "Choose a CSV file first." };
    const p = await buildPreview(staff, file);
    const groups = new Map<string, { subject: string; topic: string; count: number }>();
    for (const r of p.valid) {
      const t = r.subtopic_name ? `${r.topic_name} › ${r.subtopic_name}` : r.topic_name;
      const k = `${r.subject_name}|${t}`;
      const g = groups.get(k) ?? { subject: r.subject_name, topic: t, count: 0 };
      g.count++;
      groups.set(k, g);
    }
    return {
      ok: true,
      totalRows: p.totalRows,
      validCount: p.valid.length,
      headerErrors: p.headerErrors,
      parseErrors: p.parseErrors,
      invalid: p.invalid,
      warnings: p.valid.filter((r) => r.warnings.length).map((r) => ({ rowNumber: r.rowNumber, warnings: r.warnings })),
      newTopics: p.newTopics.map((t) => ({ subject_name: t.subject_name, name: t.name, parent: t.parent })),
      bySubject: [...groups.values()].sort((a, b) => a.subject.localeCompare(b.subject) || a.topic.localeCompare(b.topic)),
      sample: p.valid.slice(0, 5).map((r) => ({
        rowNumber: r.rowNumber,
        question_text: r.question_text,
        correct: `${r.correct_option}. ${r.options[r.correct_option]}`,
        topic: r.topic_name,
        difficulty: r.difficulty,
      })),
    };
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    console.error("[import] preview failed", e);
    return { ok: false, message: "We couldn't read that file. Make sure it is a CSV saved from the template." };
  }
}

export type CommitResult = { ok: false; message: string } | { ok: true; imported: number; skipped: number };

export async function commitQuestionImport(form: FormData): Promise<CommitResult> {
  try {
    const staff = await authorizeStaff(AUTHOR_ROLES);
    const file = fileFrom(form);
    if (!file) return { ok: false, message: "Choose a CSV file first." };
    return await commitImport(staff, file, form.get("accept_new_topics") === "on");
  } catch (e) {
    if (e instanceof AuthError) return { ok: false, message: e.message };
    console.error("[import] commit failed", e);
    return { ok: false, message: "We couldn't finish the import. Please try again." };
  }
}
