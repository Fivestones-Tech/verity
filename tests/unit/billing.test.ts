import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { activePass, decideStart } from "@/lib/entitlements/pass";
import { CENTRE_CASH_PLAN, EARLY_ACCESS, ONLINE_PLAN, isOfferOpen, naira, passEndsAt } from "@/lib/billing/plans";
import { isValidSignature } from "@/lib/billing/paystack";

describe("decideStart (free trial = one test, one subject)", () => {
  it.each([
    [{ hasActivePass: true, format: "jamb_utme", attemptsStarted: 9 }, { allowed: true, via: "pass" }],
    [{ hasActivePass: true, format: "single_subject", attemptsStarted: 0 }, { allowed: true, via: "pass" }],
    [{ hasActivePass: false, format: "single_subject", attemptsStarted: 0 }, { allowed: true, via: "trial" }],
    [{ hasActivePass: false, format: "single_subject", attemptsStarted: 1 }, { allowed: false, reason: "pass_required" }],
    [{ hasActivePass: false, format: "jamb_utme", attemptsStarted: 0 }, { allowed: false, reason: "trial_single_subject_only" }],
    [{ hasActivePass: false, format: "jamb_utme", attemptsStarted: 2 }, { allowed: false, reason: "pass_required" }],
  ] as const)("%o → %o", (facts, expected) => {
    expect(decideStart(facts)).toEqual(expected);
  });
});

describe("activePass", () => {
  const now = new Date("2027-01-10T10:00:00Z");
  const row = (starts: string, ends: string, status = "active") => ({ status, starts_at: starts, ends_at: ends });
  it("ignores expired, revoked and future passes", () => {
    expect(activePass([row("2025-01-01T00:00:00Z", "2026-01-01T00:00:00Z")], now)).toBeNull();
    expect(activePass([row("2026-12-01T00:00:00Z", "2027-12-01T00:00:00Z", "revoked")], now)).toBeNull();
    expect(activePass([row("2027-02-01T00:00:00Z", "2028-02-01T00:00:00Z")], now)).toBeNull();
  });
  it("picks the pass that lasts longest", () => {
    const a = row("2026-12-01T00:00:00Z", "2027-12-01T00:00:00Z");
    const b = row("2027-01-01T00:00:00Z", "2028-01-01T00:00:00Z");
    expect(activePass([a, b], now)).toBe(b);
  });
});

describe("Early Access prices", () => {
  it("₦500 when the centre collects it, ₦1,000 for anyone paying online, in kobo", () => {
    expect(EARLY_ACCESS.plans[CENTRE_CASH_PLAN].amountKobo).toBe(50_000);
    expect(EARLY_ACCESS.plans[ONLINE_PLAN].amountKobo).toBe(100_000);
    expect(naira(100_000)).toBe("₦1,000");
    expect(naira(50_000)).toBe("₦500");
  });
  it("offer ends at the end of 31 March 2027, Lagos time", () => {
    expect(isOfferOpen(new Date("2027-03-31T22:59:00Z"))).toBe(true);
    expect(isOfferOpen(new Date("2027-03-31T23:00:00Z"))).toBe(false);
  });
  it("a pass lasts 365 days", () => {
    expect(passEndsAt(new Date("2026-12-01T00:00:00Z")).toISOString()).toBe("2027-12-01T00:00:00.000Z");
  });
});

describe("Paystack webhook signature", () => {
  const secret = "sk_test_abc";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "VRT-1" } });
  const good = createHmac("sha512", secret).update(body).digest("hex");
  it("accepts the right signature", () => expect(isValidSignature(body, good, secret)).toBe(true));
  it("rejects a missing, wrong or tampered signature", () => {
    expect(isValidSignature(body, null, secret)).toBe(false);
    expect(isValidSignature(body, "00", secret)).toBe(false);
    expect(isValidSignature(body.replace("VRT-1", "VRT-2"), good, secret)).toBe(false);
    expect(isValidSignature(body, createHmac("sha512", "other").update(body).digest("hex"), secret)).toBe(false);
  });
});
