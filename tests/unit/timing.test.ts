import { describe, expect, it } from "vitest";
import { classifyAnswer, computeExpiry, GRACE_SECONDS, LATE_SYNC_WINDOW_SECONDS, timeUsedSeconds } from "@/lib/attempts/timing";

const t0 = new Date("2027-01-11T09:00:00Z");
const exp = new Date("2027-01-11T09:20:00Z");
const at = (s: number) => new Date(exp.getTime() + s * 1000);

describe("computeExpiry", () => {
  it("uses the duration", () => expect(computeExpiry(t0, 1200, null)).toEqual(exp));
  it("is cut short by the closing time", () => {
    const end = new Date("2027-01-11T09:10:00Z");
    expect(computeExpiry(t0, 1200, end)).toEqual(end);
  });
});

describe("classifyAnswer", () => {
  it("accepts on-time answers", () => expect(classifyAnswer(at(-60), exp, at(-61))).toBe("on_time"));
  it("accepts answers arriving within the grace period", () => expect(classifyAnswer(at(GRACE_SECONDS - 1), exp, at(-5))).toBe("on_time"));
  it("accepts answers chosen in time but synced late (connection dropped)", () => expect(classifyAnswer(at(3600), exp, at(-30))).toBe("late_sync"));
  it("rejects answers chosen after time ran out", () => expect(classifyAnswer(at(30), exp, at(30))).toBe("rejected_after_expiry"));
  it("rejects answers claiming to be from the future", () => expect(classifyAnswer(at(-600), exp, at(-60))).toBe("rejected_after_expiry"));
  it("stops waiting after the late-sync window", () => expect(classifyAnswer(at(LATE_SYNC_WINDOW_SECONDS + 1), exp, at(-30))).toBe("window_closed"));
});

describe("timeUsedSeconds", () => {
  it("never exceeds the allowed time", () => expect(timeUsedSeconds(t0, at(500), exp)).toBe(1200));
  it("counts real time when submitted early", () => expect(timeUsedSeconds(t0, new Date("2027-01-11T09:05:30Z"), exp)).toBe(330));
});
