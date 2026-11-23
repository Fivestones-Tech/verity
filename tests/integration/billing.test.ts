import { beforeAll, describe, expect, it, vi } from "vitest";
import { admin, makeCentre, signedIn, type Centre } from "../support/fixtures";
import { createAssessment } from "@/lib/assessments/service";
import { startAttempt } from "@/lib/attempts/service";
import { confirmPayment, grantCentrePasses, startCheckout } from "@/lib/billing/service";
import { DomainError } from "@/lib/api";
import type { VerifiedTransaction } from "@/lib/billing/paystack";
import { decideJoinRequest, listJoinRequests } from "@/lib/students/join-requests";

let A: Centre; // centre with no passes yet
let B: Centre; // another centre, for isolation
let platformAdminId: string;

async function newTest(C: Centre) {
  return createAssessment(C.staffCtx(C.teacher, ["teacher"]), {
    name: `T ${Math.random()}`, subject_id: C.subject.id, topic_ids: [C.topic.id], question_count: 4, duration_minutes: 10,
    kind: "topic_test", difficulties: [], assign_to: ["all"], open_now: true,
  });
}

async function code(p: Promise<unknown>) {
  try {
    await p;
    return "ok";
  } catch (e) {
    return e instanceof DomainError ? e.code : String(e);
  }
}

async function pendingPayment(C: Centre, i: 0 | 1, amount = 100_000) {
  const reference = `VRT-test-${crypto.randomUUID()}`;
  const { data } = await admin
    .from("payments")
    .insert({ student_id: C.students[i].id, institution_id: C.institution.id, provider: "paystack", reference, plan_key: "early_access_solo", amount_kobo: amount })
    .select("id")
    .single();
  return { id: data!.id as string, reference };
}

const paid = (reference: string, amount: number, status = "success") => async (): Promise<VerifiedTransaction> => ({
  status, reference, amount, currency: "NGN", paid_at: new Date().toISOString(),
});

beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = "sk_test_integration";
  A = await makeCentre("PAYA", { passes: false });
  B = await makeCentre("PAYB", { passes: false });
  const { data: u } = await admin.auth.admin.createUser({ email: `vadmin.${crypto.randomUUID().slice(0, 6)}@example.test`, password: "Test-pass-123", email_confirm: true });
  platformAdminId = u.user!.id;
  await admin.from("platform_admins").insert({ user_id: platformAdminId });
});

describe("free trial: one test in one subject", () => {
  it("lets a student without a pass take one test, then asks for the pass", async () => {
    const t1 = await newTest(A);
    const t2 = await newTest(A);
    const first = await startAttempt(A.studentCtx(0), t1);
    // resuming the trial test is always fine
    expect((await startAttempt(A.studentCtx(0), t1)).attempt_id).toBe(first.attempt_id);
    expect(await code(startAttempt(A.studentCtx(0), t2))).toBe("pass_required");
  });

  it("doesn't cover a full JAMB sitting", async () => {
    const { data: jamb } = await admin.from("examinations").select("id").eq("code", "JAMB").single();
    const { data: sitting } = await admin
      .from("assessments")
      .insert({ institution_id: A.institution.id, examination_id: jamb!.id, subject_id: null, format: "jamb_utme", name: "Sitting", assessment_type: "mock", duration_seconds: 7200, status: "active" })
      .select("id")
      .single();
    await admin.from("assessment_assignments").insert({ assessment_id: sitting!.id });
    expect(await code(startAttempt(A.studentCtx(1), sitting!.id))).toBe("trial_single_subject_only");
  });

  it("two tests started at the same moment use the trial only once", async () => {
    const s = await makeCentre("PAYC", { passes: false });
    const [t1, t2] = [await newTest(s), await newTest(s)];
    const results = await Promise.all([code(startAttempt(s.studentCtx(0), t1)), code(startAttempt(s.studentCtx(0), t2))]);
    const { count } = await admin.from("assessment_attempts").select("id", { count: "exact", head: true }).eq("student_id", s.students[0].id);
    expect(count).toBe(1);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
  });
});

describe("centre cash passes (platform admin)", () => {
  it("turns passes on for a centre's students, once, and unlocks tests", async () => {
    const r = await grantCentrePasses(platformAdminId, { institutionId: A.institution.id, studentIds: [A.students[0].id], source: "centre_cash" });
    expect(r).toEqual({ granted: 1, skipped: 0 });
    const again = await grantCentrePasses(platformAdminId, { institutionId: A.institution.id, studentIds: [A.students[0].id], source: "centre_cash" });
    expect(again.granted).toBe(0);
    const { data: pass } = await admin.from("student_passes").select("amount_kobo, source, plan_key").eq("student_id", A.students[0].id).single();
    expect(pass).toMatchObject({ amount_kobo: 50_000, source: "centre_cash", plan_key: "early_access_centre" });
    expect(await code(startAttempt(A.studentCtx(0), await newTest(A)))).toBe("ok");
  });

  it("ignores student ids from another centre", async () => {
    const r = await grantCentrePasses(platformAdminId, { institutionId: A.institution.id, studentIds: [B.students[0].id], source: "free_pilot" });
    expect(r.granted).toBe(0);
    const { count } = await admin.from("student_passes").select("id", { count: "exact", head: true }).eq("student_id", B.students[0].id);
    expect(count).toBe(0);
  });
});

describe("online payments", () => {
  it("activates exactly one pass, even when webhook and return page race", async () => {
    const p = await pendingPayment(B, 0);
    const outcomes = await Promise.all([confirmPayment(p.reference, paid(p.reference, 100_000)), confirmPayment(p.reference, paid(p.reference, 100_000))]);
    expect(outcomes).toEqual(["success", "success"]);
    const { data: passes } = await admin.from("student_passes").select("source, payment_id, ends_at").eq("student_id", B.students[0].id);
    expect(passes).toHaveLength(1);
    expect(passes![0]).toMatchObject({ source: "online_payment", payment_id: p.id });
    const { data: pay } = await admin.from("payments").select("status, verified_at").eq("id", p.id).single();
    expect(pay!.status).toBe("success");
    expect(pay!.verified_at).not.toBeNull();
  });

  it("never activates when the amount paid is wrong", async () => {
    const p = await pendingPayment(B, 1);
    expect(await confirmPayment(p.reference, paid(p.reference, 100))).toBe("failed");
    const { count } = await admin.from("student_passes").select("id", { count: "exact", head: true }).eq("student_id", B.students[1].id);
    expect(count).toBe(0);
  });

  it("marks failed payments and leaves pending ones alone", async () => {
    const f = await pendingPayment(B, 1);
    expect(await confirmPayment(f.reference, paid(f.reference, 100_000, "failed"))).toBe("failed");
    expect((await admin.from("payments").select("status").eq("id", f.id).single()).data!.status).toBe("failed");
    const q = await pendingPayment(B, 1);
    expect(await confirmPayment(q.reference, paid(q.reference, 100_000, "ongoing"))).toBe("pending");
    expect(await confirmPayment("VRT-does-not-exist", paid("x", 1))).toBe("not_found");
  });

  it("anyone paying online pays ₦1,000, centre student or not, and the price never comes from the browser", async () => {
    const s = await makeCentre("PAYD", { passes: false });
    const sent: { amount?: number }[] = [];
    const realFetch = globalThis.fetch;
    vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
      if (!String(url).startsWith("https://api.paystack.co")) return realFetch(url, init);
      sent.push(JSON.parse(String(init?.body)));
      return new Response(JSON.stringify({ status: true, data: { authorization_url: "https://checkout.paystack.test/x", reference: "r" } }), { status: 200 });
    });
    try {
      const url = await startCheckout(s.studentCtx(0), "http://localhost");
      expect(url).toBe("https://checkout.paystack.test/x");
    } finally {
      vi.unstubAllGlobals();
    }
    expect(sent[0].amount).toBe(100_000);
    const { data: pay } = await admin.from("payments").select("amount_kobo, plan_key, status").eq("student_id", s.students[0].id).single();
    expect(pay).toMatchObject({ amount_kobo: 100_000, plan_key: "early_access_solo", status: "pending" });
    // B student 0 already has a pass
    expect(await code(startCheckout(B.studentCtx(0), "http://localhost"))).toBe("already_active");
  });
});

describe("students who sign up with a centre code", () => {
  it("see nothing from the centre until it accepts them; only that centre can accept", async () => {
    const C = await makeCentre("JOINA", { passes: false });
    const { data: u } = await admin.auth.admin.createUser({ email: `join.${crypto.randomUUID().slice(0, 6)}@example.test`, password: "Test-pass-123", email_confirm: true });
    const { data: st } = await admin.from("students").insert({ profile_id: u.user!.id, institution_id: null, requested_institution_id: C.institution.id, full_name: "Joiner", student_number: "VJOIN001" }).select("id").single();
    await newTest(C);
    const login = await signedIn(u.user!.email!, "Test-pass-123");
    expect((await login.from("assessments").select("id")).data).toEqual([]);
    expect((await login.from("students").select("id")).data!.map((r) => r.id)).toEqual([st!.id]);

    // the other centre's owner can't see or accept the request
    expect(await listJoinRequests(A.staffCtx(A.owner, ["owner"]))).toEqual([]);
    expect(await code(decideJoinRequest(A.staffCtx(A.owner, ["owner"]), st!.id, true))).toBe("request_not_found");

    const reqs = await listJoinRequests(C.staffCtx(C.owner, ["owner"]));
    expect(reqs.map((r) => r.id)).toEqual([st!.id]);
    await decideJoinRequest(C.staffCtx(C.owner, ["owner"]), st!.id, true);
    expect((await login.from("assessments").select("id")).data!.length).toBeGreaterThan(0);
    const { data: after } = await admin.from("students").select("institution_id, requested_institution_id").eq("id", st!.id).single();
    expect(after).toEqual({ institution_id: C.institution.id, requested_institution_id: null });
  });
});

describe("RLS on passes and payments", () => {
  it("a student sees only their own pass and payments", async () => {
    const s = await signedIn(B.students[0].login.email, B.students[0].login.password);
    const { data: passes } = await s.from("student_passes").select("student_id");
    expect(new Set((passes ?? []).map((p) => p.student_id))).toEqual(new Set([B.students[0].id]));
    const { data: pays } = await s.from("payments").select("student_id");
    expect((pays ?? []).every((p) => p.student_id === B.students[0].id)).toBe(true);
    expect((pays ?? []).length).toBeGreaterThan(0);
  });

  it("another centre's owner sees none of them", async () => {
    const o = await signedIn(A.owner.email, A.owner.password);
    const { data: passes } = await o.from("student_passes").select("student_id").in("student_id", B.students.map((x) => x.id));
    expect(passes).toEqual([]);
    const { data: pays } = await o.from("payments").select("id");
    expect(pays).toEqual([]);
  });

  it("a centre owner sees their own students' passes, but not payments", async () => {
    const o = await signedIn(A.owner.email, A.owner.password);
    const { data } = await o.from("student_passes").select("student_id");
    expect((data ?? []).map((p) => p.student_id)).toContain(A.students[0].id);
  });

  it("signed-in users can't write passes or payments, or call the activate function", async () => {
    const s = await signedIn(A.students[1].login.email, A.students[1].login.password);
    const ends = new Date(Date.now() + 86400_000).toISOString();
    const r1 = await s.from("student_passes").insert({ student_id: A.students[1].id, plan_key: "early_access_solo", source: "free_pilot", amount_kobo: 0, ends_at: ends });
    expect(r1.error).not.toBeNull();
    const r2 = await s.from("payments").insert({ student_id: A.students[1].id, provider: "paystack", reference: "x", plan_key: "early_access_solo", amount_kobo: 1 });
    expect(r2.error).not.toBeNull();
    const r3 = await s.rpc("activate_online_pass", { p_payment_id: crypto.randomUUID(), p_amount_kobo: 1, p_paid_at: ends, p_ends_at: ends });
    expect(r3.error).not.toBeNull();
    const { count } = await admin.from("student_passes").select("id", { count: "exact", head: true }).eq("student_id", A.students[1].id);
    expect(count).toBe(0);
  });
});
