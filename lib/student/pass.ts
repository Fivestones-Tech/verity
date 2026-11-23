import "server-only";
import type { StudentContext } from "@/lib/auth/session";
import { loadStudentAccess } from "@/lib/entitlements/access";
import { isOnlineCentre } from "@/lib/billing/online-centre";
import { CENTRE_CASH_PLAN, EARLY_ACCESS, ONLINE_PLAN, isOfferOpen, naira } from "@/lib/billing/plans";
import { paystackSecret } from "@/lib/billing/paystack";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** Everything the student's pass card and pass page need, decided on the server. */
export async function loadPassSummary(ctx: StudentContext) {
  const admin = createSupabaseAdminClient();
  const [access, solo, { data: me }] = await Promise.all([
    loadStudentAccess(ctx.student.id),
    isOnlineCentre(ctx.student.institution_id),
    admin.from("students").select("requested_institution_id").eq("id", ctx.student.id).maybeSingle(),
  ]);
  // A real centre (not Verity's online centre): the student may pay ₦500 through it instead.
  let centreName: string | null = null;
  if (!solo && ctx.student.institution_id) {
    const { data } = await admin.from("institutions").select("name").eq("id", ctx.student.institution_id).maybeSingle();
    centreName = data?.name ?? null;
  }
  let pendingCentreName: string | null = null;
  if (me?.requested_institution_id) {
    const { data } = await admin.from("institutions").select("name").eq("id", me.requested_institution_id).maybeSingle();
    pendingCentreName = data?.name ?? null;
  }
  return {
    pass: access.pass,
    trialUsed: access.attemptsStarted > 0,
    centreName,
    pendingCentreName,
    onlinePrice: naira(EARLY_ACCESS.plans[ONLINE_PLAN].amountKobo),
    centrePrice: naira(EARLY_ACCESS.plans[CENTRE_CASH_PLAN].amountKobo),
    /** the cheapest price open to this student, for short copy */
    price: naira(EARLY_ACCESS.plans[centreName ? CENTRE_CASH_PLAN : ONLINE_PLAN].amountKobo),
    offerOpen: isOfferOpen(),
    offerEndsAt: EARLY_ACCESS.offerEndsAt,
    canPayOnline: Boolean(paystackSecret()),
  };
}

export function formatDay(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));
}
