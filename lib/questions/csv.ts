import Papa from "papaparse";

export type ParsedCsv = { fields: string[]; rows: Record<string, string>[]; parseErrors: string[] };

/** Parse a UTF-8 CSV with a header row. Blank lines are skipped by the parser. */
export function parseCsv(text: string): ParsedCsv {
  const clean = text.replace(/^﻿/, ""); // Excel adds a BOM
  const res = Papa.parse<Record<string, string>>(clean, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim().toLowerCase(),
  });
  const parseErrors = res.errors
    .slice(0, 20)
    .map((e) => (typeof e.row === "number" ? `Row ${e.row + 2}: ${e.message}` : e.message));
  return { fields: res.meta.fields ?? [], rows: res.data, parseErrors };
}
