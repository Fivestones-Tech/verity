/**
 * Can this student start a test? (docs/09 entitlements, founder decision D27.)
 *
 * Pure rules, no I/O, so they're table-tested. Server code loads the facts and asks here;
 * feature code never checks payments directly.
 *
 *   * An active pass unlocks every test (JAMB + WAEC, one year).
 *   * Without a pass, the free trial is ONE test in ONE subject: the student's very first
 *     attempt, and never a full JAMB sitting.
 *   * Resuming an attempt already in progress is always allowed (handled before this check),
 *     so a lapsing pass can never cost a student their answers.
 */

export type StartFacts = {
  hasActivePass: boolean;
  format: "single_subject" | "jamb_utme";
  /** attempts this student has ever started, on any test */
  attemptsStarted: number;
};

export type StartDecision =
  | { allowed: true; via: "pass" | "trial" }
  | { allowed: false; reason: "pass_required" | "trial_single_subject_only" };

export function decideStart(f: StartFacts): StartDecision {
  if (f.hasActivePass) return { allowed: true, via: "pass" };
  if (f.attemptsStarted > 0) return { allowed: false, reason: "pass_required" };
  if (f.format === "jamb_utme") return { allowed: false, reason: "trial_single_subject_only" };
  return { allowed: true, via: "trial" };
}

export type PassRow = { status: string; starts_at: string; ends_at: string };

export function activePass<T extends PassRow>(passes: T[], now: Date = new Date()): T | null {
  const t = now.getTime();
  const live = passes.filter(
    (p) => p.status === "active" && new Date(p.starts_at).getTime() <= t && new Date(p.ends_at).getTime() > t,
  );
  live.sort((a, b) => new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime());
  return live[0] ?? null;
}

export const START_MESSAGES: Record<Extract<StartDecision, { allowed: false }>["reason"], string> = {
  pass_required: "You've used your free test. Get the Early Access pass to keep practising.",
  trial_single_subject_only: "The free trial covers one test in one subject. Get the Early Access pass to sit a full JAMB mock.",
};
