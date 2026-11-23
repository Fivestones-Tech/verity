import "server-only";
import { randomBytes } from "node:crypto";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DomainError } from "@/lib/api";
import { audit } from "@/lib/audit";
import type { StudentContext } from "@/lib/auth/session";
import { CENTRE_CASH_PLAN, EARLY_ACCESS, ONLINE_PLAN, isOfferOpen, passEndsAt } from "@/lib/billing/plans";
import { initializeTransaction, paystackSecret, verifyTransaction, type VerifiedTransaction } from "@/lib/billing/paystack";
import { loadStudentAccess, activePassesFor } from "@/lib/entitlements/access";

/**
 * Early Access billing (docs/09). The flow, with no shortcuts:
 *   student taps Pay → we create a `payments` row with the amount from server config →
 *   Paystack hosted checkout → Paystack webhook (signature checked) and/or the return page →
 *   we ask Paystack's verify API for the real status and amount → activate_online_pass().
 * Nothing the browser sends decides the price, the plan or whether the payment succeeded.
 */

function db() {
  return createSupabaseAdminClient();
}

export async function startCheckout(ctx: StudentContext, origin: string): Promise<string> {
  const secret = paystackSecret();
  if (!secret) throw new DomainError("payments_off", "Online payment isn't switched on yet. Please try again soon.", 503);
  if (!isOfferOpen()) throw new DomainError("offer_ended", "The Early Access offer has ended.", 409);
  const access = await loadStudentAccess(ctx.student.id);
  if (access.pass) throw new DomainError("already_active", "Your Early Access pass is already active.", 409);

  const { data: user } = await db().auth.admin.getUserById(ctx.userId);
  const email = user?.user?.email;
  if (!email) throw new DomainError("no_email", "Your account has no email address, which payment needs.", 409);

  // Online is always the ₦1,000 price, centre or not (D30). Never from the request.
  const planKey = ONLINE_PLAN;
  const amountKobo = EARLY_ACCESS.plans[planKey].amountKobo;
  const reference = `VRT-${randomBytes(9).toString("hex")}`;
  const { data: payment, error } = await db()
    .from("payments")
    .insert({ student_id: ctx.student.id, institution_id: ctx.student.institution_id, provider: "paystack", reference, plan_key: planKey, amount_kobo: amountKobo })
    .select("id")
    .single();
  if (error || !payment) {
    console.error("[billing] payment insert failed", error?.message);
    throw new DomainError("checkout_failed", "We couldn't start the payment. Please try again.", 500);
  }

  try {
    const init = await initializeTransaction(secret, {
      email,
      amountKobo,
      reference,
      callbackUrl: `${origin}/app/pass/return`,
      metadata: { payment_id: payment.id, plan_key: planKey },
    });
    await audit({ actorUserId: ctx.userId, institutionId: ctx.student.institution_id, action: "payment.started", resourceType: "payment", resourceId: payment.id, metadata: { amount_kobo: amountKobo } });
    return init.authorization_url;
  } catch (e) {
    console.error("[billing] paystack initialize failed", e);
    await db().from("payments").update({ status: "failed", updated_at: new Date().toISOString() }).eq("id", payment.id);
    throw new DomainError("checkout_failed", "We couldn't reach the payment page. Please try again.", 502);
  }
}

export type PaymentOutcome = "success" | "pending" | "failed" | "not_found";

/**
 * Ask Paystack what really happened to a payment and activate the pass if it was paid in
 * full. Safe to call any number of times, from the webhook and the return page at once.
 */
export async function confirmPayment(
  reference: string,
  verify: (secret: string, reference: string) => Promise<VerifiedTransaction> = verifyTransaction,
): Promise<PaymentOutcome> {
  const { data: payment } = await db()
    .from("payments")
    .select("id, student_id, institution_id, amount_kobo, currency, status")
    .eq("reference", reference)
    .maybeSingle();
  if (!payment) return "not_found";
  if (payment.status === "success") return "success";

  const secret = paystackSecret();
  if (!secret) return "pending";
  let tx: VerifiedTransaction;
  try {
    tx = await verify(secret, reference);
  } catch (e) {
    console.error("[billing] paystack verify failed", e);
    return "pending";
  }
  if (tx.reference !== reference) return "pending";

  if (tx.status === "success") {
    if (tx.amount !== payment.amount_kobo || tx.currency !== payment.currency) {
      // Paid the wrong amount: never activate. Leave it for a human to look at.
      console.error("[billing] amount mismatch", { reference, expected: payment.amount_kobo, got: tx.amount, currency: tx.currency });
      await audit({ actorUserId: null, institutionId: payment.institution_id, action: "payment.amount_mismatch", resourceType: "payment", resourceId: payment.id, metadata: { expected: payment.amount_kobo, got: tx.amount, currency: tx.currency } });
      return "failed";
    }
    const paidAt = tx.paid_at ? new Date(tx.paid_at) : new Date();
    const { data: activated, error } = await db().rpc("activate_online_pass", {
      p_payment_id: payment.id,
      p_amount_kobo: tx.amount,
      p_paid_at: paidAt.toISOString(),
      p_ends_at: passEndsAt(new Date()).toISOString(),
    });
    if (error) {
      console.error("[billing] activate failed", error.message);
      return "pending";
    }
    if (activated) {
      await audit({ actorUserId: null, institutionId: payment.institution_id, action: "pass.activated", resourceType: "payment", resourceId: payment.id, metadata: { source: "online_payment" } });
    }
    return "success";
  }
  if (tx.status === "failed" || tx.status === "abandoned" || tx.status === "reversed") {
    await db()
      .from("payments")
      .update({ status: tx.status === "abandoned" ? "abandoned" : "failed", updated_at: new Date().toISOString() })
      .eq("id", payment.id)
      .eq("status", "pending");
    return "failed";
  }
  return "pending";
}

/** The return page only confirms the caller's own payment (same answer for "missing" and "not yours"). */
export async function confirmOwnPayment(ctx: StudentContext, reference: string): Promise<PaymentOutcome> {
  const { data } = await db().from("payments").select("student_id").eq("reference", reference).maybeSingle();
  if (!data || data.student_id !== ctx.student.id) return "not_found";
  return confirmPayment(reference);
}

export type GrantSource = "centre_cash" | "free_pilot";

/**
 * A Verity platform admin records that a centre paid cash (₦500 a student) or that its
 * students get a free pilot pass. Caller must already be verified as a platform admin.
 * Students already holding an active pass are skipped. Returns how many passes were added.
 */
export async function grantCentrePasses(
  adminUserId: string,
  input: { institutionId: string; studentIds: string[]; source: GrantSource; note?: string },
): Promise<{ granted: number; skipped: number }> {
  const ids = [...new Set(input.studentIds)];
  if (ids.length === 0) return { granted: 0, skipped: 0 };
  // Only students who really belong to that centre: never trust the posted ids alone.
  const { data: students } = await db()
    .from("students")
    .select("id")
    .eq("institution_id", input.institutionId)
    .in("id", ids);
  const valid = (students ?? []).map((s) => s.id as string);
  const already = await activePassesFor(valid);
  const toGrant = valid.filter((id) => !already.has(id));
  if (toGrant.length === 0) return { granted: 0, skipped: ids.length };

  const now = new Date();
  const amountKobo = input.source === "centre_cash" ? EARLY_ACCESS.plans.early_access_centre.amountKobo : 0;
  const { error } = await db()
    .from("student_passes")
    .insert(
      toGrant.map((student_id) => ({
        student_id,
        institution_id: input.institutionId,
        plan_key: CENTRE_CASH_PLAN,
        source: input.source,
        amount_kobo: amountKobo,
        starts_at: now.toISOString(),
        ends_at: passEndsAt(now).toISOString(),
        granted_by: adminUserId,
        note: input.note?.slice(0, 200) || null,
      })),
    );
  if (error) {
    console.error("[billing] grant passes failed", error.message);
    throw new DomainError("grant_failed", "We couldn't turn those passes on. Please try again.", 500);
  }
  await audit({
    actorUserId: adminUserId,
    institutionId: input.institutionId,
    action: "pass.granted",
    resourceType: "institution",
    resourceId: input.institutionId,
    metadata: { source: input.source, count: toGrant.length, amount_kobo_each: amountKobo, note: input.note ?? null },
  });
  return { granted: toGrant.length, skipped: ids.length - toGrant.length };
}
