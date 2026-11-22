import { randomInt } from "node:crypto";

/**
 * Students at a tutorial centre often have no email address. They sign in with
 * the centre code + their student number + a password. Internally each student
 * gets an auth account with a synthetic address on a reserved domain.
 */
export function normaliseCentreCode(code: string): string {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function normaliseStudentNumber(n: string): string {
  return n.trim().toUpperCase().replace(/\s+/g, "");
}

export function studentLoginEmail(centreCode: string, studentNumber: string, domain: string): string {
  const num = normaliseStudentNumber(studentNumber).toLowerCase().replace(/[^a-z0-9._-]/g, "-");
  return `${num}.${normaliseCentreCode(centreCode).toLowerCase()}@${domain}`;
}

// No 0/O, 1/I/L: these slips get read aloud and copied by hand.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generatePassword(length = 8): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}
