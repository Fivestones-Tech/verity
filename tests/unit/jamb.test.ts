import { describe, expect, it } from "vitest";
import { jambScores, sittingSubjectOrder } from "@/lib/scoring/jamb";
import { checkCombination, parseSubjectCell } from "@/lib/students/subjects";
import { validateStudents } from "@/lib/students/import-validation";

const S = [
  { id: "eng", name: "Use of English", code: "ENG" },
  { id: "mth", name: "Mathematics", code: "MTH" },
  { id: "phy", name: "Physics", code: "PHY" },
  { id: "chm", name: "Chemistry", code: "CHM" },
  { id: "bio", name: "Biology", code: "BIO" },
  { id: "lit", name: "Literature in English", code: "LIT" },
  { id: "acc", name: "Principles of Accounts", code: "ACC" },
];

describe("JAMB-style scoring", () => {
  it("marks each subject out of 100 and sums to /400", () => {
    const qs = [
      ...Array.from({ length: 60 }, (_, i) => ({ subject_id: "eng", is_correct: i < 45 })), // 75
      ...Array.from({ length: 40 }, (_, i) => ({ subject_id: "mth", is_correct: i < 22 })), // 55
      ...Array.from({ length: 40 }, (_, i) => ({ subject_id: "phy", is_correct: i < 30 })), // 75
      ...Array.from({ length: 40 }, () => ({ subject_id: "chm", is_correct: false })), // 0
    ];
    const r = jambScores(qs, ["eng", "chm", "mth", "phy"]);
    expect(r.subjects.map((s) => [s.subject_id, s.score])).toEqual([["eng", 75], ["chm", 0], ["mth", 55], ["phy", 75]]);
    expect(r.total).toBe(205);
    expect(r.max).toBe(400);
  });
  it("rounds to whole marks", () => {
    expect(jambScores([{ subject_id: "x", is_correct: true }, { subject_id: "x", is_correct: false }, { subject_id: "x", is_correct: false }], ["x"]).total).toBe(33);
  });
  it("orders English first, then by name", () => {
    expect(sittingSubjectOrder([S[3], S[2], S[0], S[1]])).toEqual(["eng", "chm", "mth", "phy"]);
  });
});

describe("student subject combinations", () => {
  it.each([
    ["Physics; Chemistry; Biology", ["phy", "chm", "bio"]],
    ["maths, phy, chem", ["mth", "phy", "chm"]],
    ["English; Literature; Accounts; Maths", ["lit", "acc", "mth"]],
    ["PHY|CHM|BIO", ["phy", "chm", "bio"]],
  ])("%s", (cell, ids) => {
    expect(parseSubjectCell(cell, S)).toEqual({ ids, errors: [] });
  });
  it("blank means not set", () => {
    expect(parseSubjectCell("  ", S)).toEqual({ ids: [], errors: [] });
  });
  it("rejects unknown names and wrong counts", () => {
    expect(parseSubjectCell("Physics; Chemistry; Astrology", S).errors[0]).toMatch(/unknown subject: Astrology/);
    expect(parseSubjectCell("Physics; Chemistry", S).errors[0]).toMatch(/exactly 3/);
    expect(parseSubjectCell("Physics; Physics; Chemistry", S).errors[0]).toMatch(/exactly 3/);
  });
  it("rejects ids that aren't JAMB subjects", () => {
    expect(checkCombination(["phy", "chm", "waec-bio"], S).errors[0]).toMatch(/isn't a JAMB subject/);
  });
});

describe("student import with subjects", () => {
  it("reads the optional subjects column", () => {
    const r = validateStudents({
      fields: ["full_name", "student_number", "class", "subjects"],
      rows: [
        { full_name: "Ada Obi", student_number: "1", class: "", subjects: "Physics; Chemistry; Biology" },
        { full_name: "Bayo Ade", student_number: "2", class: "", subjects: "" },
        { full_name: "Chi Eze", student_number: "3", class: "", subjects: "Physics" },
      ],
      existingNumbers: new Set(),
      existingClasses: [],
      subjects: S,
    });
    expect(r.valid.map((v) => v.subject_ids)).toEqual([["phy", "chm", "bio"], []]);
    expect(r.invalid[0].errors[0]).toMatch(/exactly 3/);
  });
});
