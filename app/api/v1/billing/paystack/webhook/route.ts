import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { isValidSignature, paystackSecret } from "@/lib/billing/paystack";
import { confirmPayment } from "@/lib/billing/service";

/**
 * Paystack webhook (docs/09, rule 4). The signature proves the call came from Paystack;
 * we still re-check the transaction with Paystack's verify API inside confirmPayment()
 * and compare the amount with what we asked for before turning a pass on.
 */
export async function POST(req: NextRequest) {
  const secret = paystackSecret();
  if (!secret) return NextResponse.json({ ok: false }, { status: 503 });
  const raw = await req.text();
  if (!isValidSignature(raw, req.headers.get("x-paystack-signature"), secret)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  let event: { event?: string; data?: { reference?: unknown } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const reference = typeof event.data?.reference === "string" ? event.data.reference : null;
  if (reference && (event.event === "charge.success" || event.event === "charge.failed")) {
    const outcome = await confirmPayment(reference);
    // Ask Paystack to retry later if we couldn't confirm yet.
    if (outcome === "pending") return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
