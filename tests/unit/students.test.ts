import { describe, expect, it } from "vitest";
import { validateStudents } from "@/lib/students/import-validation";
import { generatePassword, studentLoginEmail } from "@/lib/auth/student-login";

describe("student import validation", () => {
  it("validates rows, normalises numbers and finds new classes", () => {
    const p = validateStudents({
      fields: ["full_name", "student_number", "class"],
      rows: [
        { full_name: "Ada  Obi", student_number: " vb001 ", class: "batch a" },
        { full_name: "Tunde", student_number: "VB001", class: "" },
        { full_name: "", student_number: "VB003", class: "" },
        { full_name: "Ngozi", student_number: "VB004", class: "Batch B" },
        { full_name: "Old", student_number: "VB009", class: "" },
      ],
      existingNumbers: new Set(["VB009"]),
      existingClasses: ["Batch A"],
    });
    expect(p.valid.map((v) => [v.full_name, v.student_number, v.class_name])).toEqual([
      ["Ada Obi", "VB001", "Batch A"],
      ["Ngozi", "VB004", "Batch B"],
    ]);
    expect(p.newClasses).toEqual(["Batch B"]);
    expect(p.invalid.map((r) => r.rowNumber)).toEqual([3, 4, 6]);
  });
});

describe("student logins", () => {
  it("builds a stable internal address from centre code + number", () => {
    expect(studentLoginEmail(" brightstar ", "vb 001", "students.verity.invalid")).toBe("vb001.brightstar@students.verity.invalid");
    expect(studentLoginEmail("BRIGHTSTAR", "VB/001", "x.invalid")).toBe("vb-001.brightstar@x.invalid");
  });
  it("generates unambiguous passwords", () => {
    for (let i = 0; i < 200; i++) expect(generatePassword()).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
  });
});
