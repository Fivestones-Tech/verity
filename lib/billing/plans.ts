/**
 * Early Access pass pricing (founder decisions 2026-11-23, docs/09 "Early Access").
 * The only place these numbers live. Money is integer kobo.
 */

export type PlanKey = "early_access_centre" | "early_access_solo";

export const EARLY_ACCESS = {
  /** Last moment the early-access price can be bought: 31 March 2027, end of day in Lagos. */
  offerEndsAt: "2027-03-31T23:59:59+01:00",
  /** A pass lasts a full year from the day it is turned on. */
  durationDays: 365,
  plans: {
    early_access_centre: { amountKobo: 50_000, label: "Early Access pass (through your centre)" },
    early_access_solo: { amountKobo: 100_000, label: "Early Access pass (paid online)" },
  } satisfies Record<PlanKey, { amountKobo: number; label: string }>,
} as const;

export function isOfferOpen(now: Date = new Date()): boolean {
  return now.getTime() <= new Date(EARLY_ACCESS.offerEndsAt).getTime();
}

export function passEndsAt(from: Date): Date {
  return new Date(from.getTime() + EARLY_ACCESS.durationDays * 24 * 60 * 60 * 1000);
}

/**
 * ₦500 only when the centre collects the money and pays Verity (recorded by an admin).
 * Anyone paying online, with or without a centre, pays the ₦1,000 price (D30).
 */
export const ONLINE_PLAN: PlanKey = "early_access_solo";
export const CENTRE_CASH_PLAN: PlanKey = "early_access_centre";

export function naira(kobo: number): string {
  return `₦${(kobo / 100).toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}
