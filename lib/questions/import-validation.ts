import { z } from "zod";

/**
 * Bulk question import validation (docs/08, docs/18).
 * Pure: takes parsed CSV rows plus the reference data, returns a preview.
 * Never auto-corrects: a malformed row is rejected with a specific reason.
 */

export const TEMPLATE_COLUMNS = [
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "subject",
  "topic",
  "subtopic",
  "difficulty",
  "explanation",
  "source",
  "exam",
  "year_reference",
] as const;

export const REQUIRED_COLUMNS = [
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "correct_option",
  "subject",
  "topic",
  "difficulty",
  "source",
  "exam",
] as const;

export const MAX_ROWS = 2000;

export type RefSubject = { id: string; name: string; code: string; examination_id: string; exam_code: string };
export type RefTopic = { id: string; subject_id: string; parent_topic_id: string | null; name: string };

export type ValidRow = {
  rowNumber: number; // 1-based spreadsheet row, counting the header as row 1
  question_text: string;
  options: { A: string; B: string; C: string; D: string };
  correct_option: "A" | "B" | "C" | "D";
  subject_id: string;
  subject_name: string;
  examination_id: string;
  topic_name: string;
  subtopic_name: string | null;
  /** existing topic id, or null when the topic is new and must be created */
  topic_id: string | null;
  subtopic_id: string | null;
  difficulty: "easy" | "moderate" | "difficult";
  explanation: string | null;
  source: "original" | "licensed" | "institution" | "expert_created";
  year_reference: string | null;
  warnings: string[];
};

export type RowError = { rowNumber: number; errors: string[]; preview: string };

export type NewTopic = { subject_id: string; subject_name: string; name: string; parent: string | null };

export type ImportPreview = {
  headerErrors: string[];
  valid: ValidRow[];
  invalid: RowError[];
  newTopics: NewTopic[];
  totalRows: number;
};

const difficultySchema = z.enum(["easy", "moderate", "difficult"]);
const sourceSchema = z.enum(["original", "licensed", "institution", "expert_created"]);

export function normaliseText(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function examCodeFrom(raw: string): "JAMB" | "WAEC" | null {
  const v = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (["JAMB", "UTME", "JAMB/UTME"].includes(v)) return "JAMB";
  if (["WAEC", "WASSCE", "WAEC/WASSCE"].includes(v)) return "WAEC";
  return null;
}

function cell(row: Record<string, unknown>, key: string): string {
  const v = row[key];
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim();
}

export function validateHeader(fields: string[]): string[] {
  const have = new Set(fields.map((f) => f.trim().toLowerCase()));
  const missing = REQUIRED_COLUMNS.filter((c) => !have.has(c));
  return missing.length ? [`Missing column(s): ${missing.join(", ")}. Download the template and keep its header row.`] : [];
}

export function validateImport(args: {
  fields: string[];
  rows: Record<string, unknown>[];
  subjects: RefSubject[];
  topics: RefTopic[];
  /** normalised question text per subject id already in the bank */
  existingQuestionKeys: Set<string>;
  allowedExamCodes: ("JAMB" | "WAEC")[];
}): ImportPreview {
  const headerErrors = validateHeader(args.fields);
  const preview: ImportPreview = { headerErrors, valid: [], invalid: [], newTopics: [], totalRows: args.rows.length };
  if (headerErrors.length) return preview;
  if (args.rows.length > MAX_ROWS) {
    preview.headerErrors.push(`This file has ${args.rows.length} rows. Please split it into files of ${MAX_ROWS} rows or fewer.`);
    return preview;
  }

  const seenInFile = new Map<string, number>();
  const newTopicKeys = new Map<string, NewTopic>();

  args.rows.forEach((raw, i) => {
    const rowNumber = i + 2;
    // lower-case keys so "Question_Text" headers still work
    const row: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(raw)) row[k.trim().toLowerCase()] = v;

    const errors: string[] = [];
    const warnings: string[] = [];
    const questionText = cell(row, "question_text");
    const opts = {
      A: cell(row, "option_a"),
      B: cell(row, "option_b"),
      C: cell(row, "option_c"),
      D: cell(row, "option_d"),
    };

    // skip fully blank lines silently? No: docs/08 says never silently drop. Report them.
    if (!questionText) errors.push("question_text is empty");
    (["A", "B", "C", "D"] as const).forEach((k) => {
      if (!opts[k]) errors.push(`option_${k.toLowerCase()} is empty`);
    });
    const filled = Object.values(opts).filter(Boolean).map(normaliseText);
    if (new Set(filled).size !== filled.length) errors.push("two or more options are the same");

    const correct = cell(row, "correct_option").toUpperCase();
    if (!["A", "B", "C", "D"].includes(correct)) {
      errors.push(`correct_option must be A, B, C or D (got "${cell(row, "correct_option")}")`);
    }

    const diff = difficultySchema.safeParse(cell(row, "difficulty").toLowerCase());
    if (!diff.success) errors.push(`difficulty must be easy, moderate or difficult (got "${cell(row, "difficulty")}")`);

    const src = sourceSchema.safeParse(cell(row, "source").toLowerCase());
    if (!src.success) {
      errors.push(`source must be original, licensed, institution or expert_created (got "${cell(row, "source")}")`);
    }

    const examCode = examCodeFrom(cell(row, "exam"));
    if (!examCode) errors.push(`exam must be JAMB or WAEC (got "${cell(row, "exam")}")`);
    else if (!args.allowedExamCodes.includes(examCode)) {
      errors.push(`your centre is not set up for ${examCode} questions`);
    }

    const subjectRaw = cell(row, "subject");
    const subject = examCode
      ? args.subjects.find(
          (s) =>
            s.exam_code === examCode &&
            (normaliseText(s.name) === normaliseText(subjectRaw) || s.code.toLowerCase() === subjectRaw.toLowerCase()),
        )
      : undefined;
    if (!subjectRaw) errors.push("subject is empty");
    else if (examCode && !subject) {
      const names = args.subjects.filter((s) => s.exam_code === examCode).map((s) => s.name);
      errors.push(`subject "${subjectRaw}" is not a ${examCode} subject in Verity (use one of: ${names.join(", ")})`);
    }

    const topicName = cell(row, "topic");
    const subtopicName = cell(row, "subtopic") || null;
    if (!topicName) errors.push("topic is empty");

    let topicId: string | null = null;
    let subtopicId: string | null = null;
    if (subject && topicName) {
      const topic = args.topics.find(
        (t) => t.subject_id === subject.id && !t.parent_topic_id && normaliseText(t.name) === normaliseText(topicName),
      );
      topicId = topic?.id ?? null;
      if (!topic) {
        const key = `${subject.id}|${normaliseText(topicName)}|`;
        if (!newTopicKeys.has(key)) newTopicKeys.set(key, { subject_id: subject.id, subject_name: subject.name, name: topicName, parent: null });
      }
      if (subtopicName) {
        const sub = topic
          ? args.topics.find(
              (t) => t.subject_id === subject.id && t.parent_topic_id === topic.id && normaliseText(t.name) === normaliseText(subtopicName),
            )
          : undefined;
        subtopicId = sub?.id ?? null;
        if (!sub) {
          const key = `${subject.id}|${normaliseText(topicName)}|${normaliseText(subtopicName)}`;
          if (!newTopicKeys.has(key)) newTopicKeys.set(key, { subject_id: subject.id, subject_name: subject.name, name: subtopicName, parent: topicName });
        }
      }
    }

    if (subject && questionText) {
      const key = `${subject.id}|${normaliseText(questionText)}`;
      if (args.existingQuestionKeys.has(key)) errors.push("this question is already in your question bank");
      const firstRow = seenInFile.get(key);
      if (firstRow) errors.push(`duplicate of row ${firstRow} in this file`);
      else seenInFile.set(key, rowNumber);
    }

    const explanation = cell(row, "explanation") || null;
    if (!explanation) warnings.push("no explanation: students will not see why the answer is correct");
    const source = src.success ? src.data : null;
    const yearRef = cell(row, "year_reference") || null;
    if (yearRef && source !== "licensed") {
      warnings.push("year_reference is only for licensed past-question material");
    }

    if (errors.length || !subject || !diff.success || !source || !examCode) {
      preview.invalid.push({ rowNumber, errors, preview: questionText.slice(0, 80) });
      return;
    }

    preview.valid.push({
      rowNumber,
      question_text: questionText,
      options: opts,
      correct_option: correct as ValidRow["correct_option"],
      subject_id: subject.id,
      subject_name: subject.name,
      examination_id: subject.examination_id,
      topic_name: topicName,
      subtopic_name: subtopicName,
      topic_id: topicId,
      subtopic_id: subtopicId,
      difficulty: diff.data,
      explanation,
      source,
      year_reference: yearRef,
      warnings,
    });
  });

  preview.newTopics = [...newTopicKeys.values()];
  return preview;
}
