import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { audit } from "@/lib/audit";
import type { StaffContext } from "@/lib/auth/session";
import { parseCsv } from "@/lib/questions/csv";
import { validateImport, type ImportPreview, type ValidRow } from "@/lib/questions/import-validation";
import { allowedExamCodes, existingQuestionKeys, loadSubjects, loadTopics } from "@/lib/questions/repo";

export const MAX_FILE_BYTES = 3 * 1024 * 1024;

export async function buildPreview(staff: StaffContext, file: File): Promise<ImportPreview & { parseErrors: string[] }> {
  if (file.size > MAX_FILE_BYTES) {
    return { headerErrors: ["This file is larger than 3 MB. Please split it into smaller files."], valid: [], invalid: [], newTopics: [], totalRows: 0, parseErrors: [] };
  }
  const text = await file.text();
  const { fields, rows, parseErrors } = parseCsv(text);
  const subjects = await loadSubjects(staff.institution.exam_focus);
  const topics = await loadTopics(staff.institution.id, subjects.map((s) => s.id));
  const existing = await existingQuestionKeys(staff.institution.id);
  const preview = validateImport({
    fields,
    rows,
    subjects,
    topics,
    existingQuestionKeys: existing,
    allowedExamCodes: allowedExamCodes(staff.institution.exam_focus),
  });
  return { ...preview, parseErrors };
}

/**
 * Commit an import. The file is validated again here: the preview the browser saw
 * is never trusted. Questions enter as 'review' so a second person must approve
 * them before any student sees them (docs/08, docs/18).
 */
export async function commitImport(staff: StaffContext, file: File, acceptNewTopics: boolean) {
  const preview = await buildPreview(staff, file);
  if (preview.headerErrors.length) return { ok: false as const, message: preview.headerErrors[0] };
  if (preview.valid.length === 0) return { ok: false as const, message: "There are no valid questions to import." };
  if (preview.newTopics.length && !acceptNewTopics) {
    return { ok: false as const, message: "Please confirm the new topics before importing." };
  }

  const admin = createSupabaseAdminClient();

  // 1. Create missing topics (private to this centre, pending syllabus verification)
  const topicId = new Map<string, string>(); // `${subject}|${topic}|${subtopic}` -> id
  const key = (subject: string, topic: string, sub: string | null) =>
    `${subject}|${topic.toLowerCase().trim()}|${(sub ?? "").toLowerCase().trim()}`;
  for (const t of preview.newTopics.filter((t) => t.parent === null)) {
    const { data, error } = await admin
      .from("topics")
      .insert({ subject_id: t.subject_id, name: t.name, institution_id: staff.institution.id, created_by: staff.userId })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[import] topic insert failed", error?.message);
      return { ok: false as const, message: "We couldn't add the new topics. Nothing was imported. Please try again." };
    }
    topicId.set(key(t.subject_id, t.name, null), data.id);
  }
  const resolveTopic = (r: ValidRow) => r.topic_id ?? topicId.get(key(r.subject_id, r.topic_name, null)) ?? null;
  for (const t of preview.newTopics.filter((t) => t.parent !== null)) {
    const parentId =
      topicId.get(key(t.subject_id, t.parent!, null)) ??
      preview.valid.find((r) => r.subject_id === t.subject_id && r.topic_name.toLowerCase() === t.parent!.toLowerCase())?.topic_id;
    if (!parentId) continue;
    const { data, error } = await admin
      .from("topics")
      .insert({ subject_id: t.subject_id, name: t.name, parent_topic_id: parentId, institution_id: staff.institution.id, created_by: staff.userId })
      .select("id")
      .single();
    if (error || !data) {
      console.error("[import] subtopic insert failed", error?.message);
      return { ok: false as const, message: "We couldn't add the new topics. Nothing was imported. Please try again." };
    }
    topicId.set(key(t.subject_id, t.parent!, t.name), data.id);
  }

  // 2. Insert questions in chunks, then their options
  let imported = 0;
  const chunk = 200;
  for (let i = 0; i < preview.valid.length; i += chunk) {
    const rows = preview.valid.slice(i, i + chunk);
    const payload = rows.map((r) => {
      const top = resolveTopic(r);
      const sub = r.subtopic_name ? (r.subtopic_id ?? topicId.get(key(r.subject_id, r.topic_name, r.subtopic_name)) ?? null) : null;
      return {
        subject_id: r.subject_id,
        examination_id: r.examination_id,
        topic_id: sub ?? top,
        institution_id: staff.institution.id,
        question_type: "mcq",
        question_text: r.question_text,
        difficulty: r.difficulty,
        explanation: r.explanation,
        source: r.source,
        year_reference: r.year_reference,
        status: "review",
        created_by: staff.userId,
      };
    });
    if (payload.some((p) => !p.topic_id)) {
      return { ok: false as const, message: `Some topics could not be matched. ${imported} questions were imported before this.` };
    }
    const { data: qs, error } = await admin.from("questions").insert(payload).select("id");
    if (error || !qs) {
      console.error("[import] question insert failed", error?.message);
      return { ok: false as const, message: `We couldn't finish the import. ${imported} questions were saved. Please re-upload; saved questions will show as duplicates and be skipped.` };
    }
    const options = qs.flatMap((q, j) =>
      (["A", "B", "C", "D"] as const).map((k) => ({
        question_id: q.id,
        option_key: k,
        option_text: rows[j].options[k],
        is_correct: rows[j].correct_option === k,
      })),
    );
    const { error: oErr } = await admin.from("question_options").insert(options);
    if (oErr) {
      console.error("[import] option insert failed", oErr.message);
      await admin.from("questions").delete().in("id", qs.map((q) => q.id));
      return { ok: false as const, message: `We couldn't finish the import. ${imported} questions were saved. Please try again.` };
    }
    imported += qs.length;
  }

  await audit({
    actorUserId: staff.userId,
    institutionId: staff.institution.id,
    action: "questions.imported",
    resourceType: "question",
    metadata: { imported, skipped: preview.invalid.length, new_topics: preview.newTopics.length, file: file.name },
  });
  return { ok: true as const, imported, skipped: preview.invalid.length };
}
