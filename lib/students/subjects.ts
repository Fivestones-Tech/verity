/**
 * A student's JAMB subject combination: English is compulsory, plus exactly 3 others.
 * Pure: parses the spreadsheet's "subjects" cell and checks a chosen set.
 */
import { JAMB_SITTING } from "@/lib/assessments/kinds";

export type RefSubjectLite = { id: string; name: string; code: string };

/** Common short names teachers write. Keys and values are lower case. */
const ALIASES: Record<string, string> = {
  maths: "mth", math: "mth", mathematics: "mth",
  english: "eng", "use of english": "eng", "english language": "eng",
  accounts: "acc", accounting: "acc", "principles of accounts": "acc", "financial accounting": "acc",
  literature: "lit", "lit in english": "lit", "literature in english": "lit", "literature-in-english": "lit",
  crk: "crs", "christian religious studies": "crs", "christian religious knowledge": "crs",
  govt: "gov", government: "gov",
  econs: "eco", economics: "eco",
  bio: "bio", biology: "bio", chem: "chm", chemistry: "chm", phy: "phy", physics: "phy", commerce: "com",
};

export function findSubject(token: string, subjects: RefSubjectLite[]): RefSubjectLite | undefined {
  const t = token.trim().toLowerCase().replace(/\s+/g, " ");
  if (!t) return undefined;
  const code = ALIASES[t] ?? t;
  return subjects.find((s) => s.code.toLowerCase() === code || s.name.toLowerCase() === t);
}

export type SubjectCheck = { ids: string[]; errors: string[] };

/** Exactly 3 different subjects besides English, all from the list. English, if listed, is dropped. */
export function checkCombination(ids: string[], subjects: RefSubjectLite[]): SubjectCheck {
  const byId = new Map(subjects.map((s) => [s.id, s]));
  const errors: string[] = [];
  const unique = [...new Set(ids)].filter((id) => byId.get(id)?.code !== JAMB_SITTING.englishCode);
  if (unique.some((id) => !byId.has(id))) errors.push("one of the subjects isn't a JAMB subject");
  else if (unique.length !== JAMB_SITTING.subjectsPerStudent) {
    errors.push(`choose exactly ${JAMB_SITTING.subjectsPerStudent} subjects besides English (got ${unique.length})`);
  }
  return { ids: errors.length ? [] : unique, errors };
}

/** Parse a cell like "Physics; Chemistry; Biology". Blank means "not set yet". */
export function parseSubjectCell(cell: string, subjects: RefSubjectLite[]): SubjectCheck {
  const tokens = cell.split(/[;,|/]/).map((t) => t.trim()).filter(Boolean);
  if (tokens.length === 0) return { ids: [], errors: [] };
  const unknown = tokens.filter((t) => !findSubject(t, subjects));
  if (unknown.length) return { ids: [], errors: [`unknown subject${unknown.length > 1 ? "s" : ""}: ${unknown.join(", ")}`] };
  return checkCombination(tokens.map((t) => findSubject(t, subjects)!.id), subjects);
}
