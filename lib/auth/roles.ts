export type StaffRole = "owner" | "admin" | "teacher" | "tutor" | "staff";

/** Roles that can manage the whole institution (students, staff, settings). */
export const MANAGER_ROLES: StaffRole[] = ["owner", "admin"];
/** Roles that can author questions and build/assign assessments. */
export const AUTHOR_ROLES: StaffRole[] = ["owner", "admin", "teacher", "tutor"];
/** Roles that can review (approve/publish) questions. */
export const REVIEWER_ROLES: StaffRole[] = ["owner", "admin", "teacher", "tutor"];

export function hasAnyRole(held: StaffRole[], allowed: StaffRole[]): boolean {
  return held.some((r) => allowed.includes(r));
}
