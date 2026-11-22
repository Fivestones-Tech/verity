import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/questions/csv";
import { validateImport, type RefSubject, type RefTopic } from "@/lib/questions/import-validation";

const subjects: RefSubject[] = [
  { id: "mth", name: "Mathematics", code: "MTH", examination_id: "jamb", exam_code: "JAMB" },
  { id: "eng", name: "Use of English", code: "ENG", examination_id: "jamb", exam_code: "JAMB" },
  { id: "wmth", name: "Mathematics", code: "MTH", examination_id: "waec", exam_code: "WAEC" },
];
const topics: RefTopic[] = [{ id: "alg", subject_id: "mth", parent_topic_id: null, name: "Algebra" }];
const header = "question_text,option_a,option_b,option_c,option_d,correct_option,subject,topic,subtopic,difficulty,explanation,source,exam,year_reference";

function run(lines: string[], opts: { existing?: string[]; exams?: ("JAMB" | "WAEC")[] } = {}) {
  const { fields, rows } = parseCsv([header, ...lines].join("\n"));
  return validateImport({ fields, rows, subjects, topics, existingQuestionKeys: new Set(opts.existing ?? []), allowedExamCodes: opts.exams ?? ["JAMB"] });
}

describe("question import validation", () => {
  it("accepts a good row and matches subject + topic case-insensitively", () => {
    const p = run([`"2x=4, x=?",1,2,3,4,b,mathematics,algebra,,Easy,Because,original,jamb,`]);
    expect(p.invalid).toEqual([]);
    expect(p.valid[0]).toMatchObject({ rowNumber: 2, correct_option: "B", subject_id: "mth", topic_id: "alg", difficulty: "easy" });
  });

  it("rejects bad rows with specific reasons instead of fixing them", () => {
    const p = run([`Q1,1,2,3,4,E,Mathematics,Algebra,,medium,,copied,JAMB,`]);
    expect(p.valid).toHaveLength(0);
    const errs = p.invalid[0].errors.join(" | ");
    expect(errs).toContain("correct_option must be A, B, C or D");
    expect(errs).toContain("difficulty must be easy, moderate or difficult");
    expect(errs).toContain("source must be");
  });

  it("rejects missing options and duplicate options", () => {
    const p = run([`Q1,1,,3,4,A,Mathematics,Algebra,,easy,,original,JAMB,`, `Q2,same,Same,3,4,A,Mathematics,Algebra,,easy,,original,JAMB,`]);
    expect(p.invalid[0].errors).toContain("option_b is empty");
    expect(p.invalid[1].errors).toContain("two or more options are the same");
  });

  it("rejects unknown subjects and exams the centre doesn't do", () => {
    const p = run([`Q1,1,2,3,4,A,Basket Weaving,X,,easy,,original,JAMB,`, `Q2,1,2,3,4,A,Mathematics,Algebra,,easy,,original,WAEC,`]);
    expect(p.invalid[0].errors.join()).toContain('subject "Basket Weaving" is not a JAMB subject');
    expect(p.invalid[1].errors.join()).toContain("not set up for WAEC");
  });

  it("detects duplicates within the file and against the bank", () => {
    const p = run([`Same question,1,2,3,4,A,Mathematics,Algebra,,easy,,original,JAMB,`, `same  QUESTION,1,2,3,4,A,Mathematics,Algebra,,easy,,original,JAMB,`, `Old one,1,2,3,4,A,Mathematics,Algebra,,easy,,original,JAMB,`], {
      existing: ["mth|old one"],
    });
    expect(p.valid).toHaveLength(1);
    expect(p.invalid.find((r) => r.rowNumber === 3)!.errors).toContain("duplicate of row 2 in this file");
    expect(p.invalid.find((r) => r.rowNumber === 4)!.errors).toContain("this question is already in your question bank");
  });

  it("lists new topics and subtopics without creating them", () => {
    const p = run([`Q1,1,2,3,4,A,Mathematics,Statistics,Mean,easy,,original,JAMB,`, `Q2,1,2,3,4,A,Mathematics,Algebra,Indices,easy,,original,JAMB,`]);
    expect(p.valid).toHaveLength(2);
    expect(p.newTopics).toEqual([
      { subject_id: "mth", subject_name: "Mathematics", name: "Statistics", parent: null },
      { subject_id: "mth", subject_name: "Mathematics", name: "Mean", parent: "Statistics" },
      { subject_id: "mth", subject_name: "Mathematics", name: "Indices", parent: "Algebra" },
    ]);
  });

  it("reports a missing header column", () => {
    const { rows } = parseCsv("question_text,option_a\nx,y");
    const p = validateImport({ fields: ["question_text", "option_a"], rows, subjects, topics, existingQuestionKeys: new Set(), allowedExamCodes: ["JAMB"] });
    expect(p.headerErrors[0]).toContain("Missing column(s)");
  });

  it("warns (but accepts) when there is no explanation", () => {
    const p = run([`Q1,1,2,3,4,A,Mathematics,Algebra,,easy,,original,JAMB,`]);
    expect(p.valid[0].warnings[0]).toContain("no explanation");
  });

  it("handles quoted commas and an Excel BOM", () => {
    const { fields, rows } = parseCsv("﻿" + header + '\n"Which is larger, 2 or 3?",2,3,"both, equally",neither,B,Mathematics,Algebra,,easy,,original,JAMB,');
    const p = validateImport({ fields, rows, subjects, topics, existingQuestionKeys: new Set(), allowedExamCodes: ["JAMB"] });
    expect(p.valid[0].options.C).toBe("both, equally");
  });
});
