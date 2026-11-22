/**
 * Timing rules for an attempt (docs/17). Pure so they can be tested directly.
 *
 * - The server fixes started_at and expires_at when the attempt starts.
 * - GRACE covers ordinary sync delay after the timer reaches zero.
 * - A student whose connection drops keeps answering on the device. Answers they
 *   chose before time ran out may reach the server later, within LATE_SYNC_WINDOW.
 *   Those attempts are marked synced_late so teachers can see it.
 * - Answers chosen after expiry are always rejected.
 */
export const GRACE_SECONDS = 60;
export const LATE_SYNC_WINDOW_SECONDS = 6 * 60 * 60;
/** Allowance for the client's estimate of server time drifting. */
export const CLOCK_SKEW_SECONDS = 15;

export function computeExpiry(startedAt: Date, durationSeconds: number, endAt: Date | null): Date {
  const byDuration = new Date(startedAt.getTime() + durationSeconds * 1000);
  return endAt && endAt < byDuration ? endAt : byDuration;
}

export type AnswerTiming = "on_time" | "late_sync" | "rejected_after_expiry" | "window_closed";

export function classifyAnswer(now: Date, expiresAt: Date, answeredAt: Date): AnswerTiming {
  const exp = expiresAt.getTime();
  if (now.getTime() > exp + LATE_SYNC_WINDOW_SECONDS * 1000) return "window_closed";
  if (answeredAt.getTime() > exp + CLOCK_SKEW_SECONDS * 1000) return "rejected_after_expiry";
  // answered_at is client-reported, so it can never be later than the server's now
  if (answeredAt.getTime() > now.getTime() + CLOCK_SKEW_SECONDS * 1000) return "rejected_after_expiry";
  if (now.getTime() > exp + GRACE_SECONDS * 1000) return "late_sync";
  return "on_time";
}

/** Has the server stopped waiting for this attempt's answers? */
export function lateWindowPassed(now: Date, expiresAt: Date): boolean {
  return now.getTime() > expiresAt.getTime() + LATE_SYNC_WINDOW_SECONDS * 1000;
}

export function isPastGrace(now: Date, expiresAt: Date): boolean {
  return now.getTime() > expiresAt.getTime() + GRACE_SECONDS * 1000;
}

export function timeUsedSeconds(startedAt: Date, submittedAt: Date, expiresAt: Date): number {
  const end = Math.min(submittedAt.getTime(), expiresAt.getTime());
  return Math.max(0, Math.round((end - startedAt.getTime()) / 1000));
}
