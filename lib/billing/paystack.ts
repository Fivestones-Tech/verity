import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Minimal Paystack client (https://paystack.com/docs/api/). Server only: the secret key
 * never reaches the browser. We use the hosted checkout page, so no public key is needed.
 */

const BASE = "https://api.paystack.co";

export function paystackSecret(): string | null {
  return process.env.PAYSTACK_SECRET_KEY || null;
}

/** Paystack signs each webhook body with HMAC-SHA512 of the raw body using the secret key. */
export function isValidSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

async function call<T>(path: string, init: RequestInit, secret: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const body = (await res.json().catch(() => null)) as { status?: boolean; message?: string; data?: T } | null;
  if (!res.ok || !body?.status || !body.data) {
    throw new Error(`paystack ${path} failed: ${res.status} ${body?.message ?? ""}`);
  }
  return body.data;
}

export async function initializeTransaction(
  secret: string,
  input: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, string> },
): Promise<{ authorization_url: string; reference: string }> {
  return call(
    "/transaction/initialize",
    {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        amount: input.amountKobo,
        currency: "NGN",
        reference: input.reference,
        callback_url: input.callbackUrl,
        metadata: input.metadata,
      }),
    },
    secret,
  );
}

export type VerifiedTransaction = {
  status: "success" | "failed" | "abandoned" | "ongoing" | "pending" | "processing" | "queued" | "reversed" | string;
  reference: string;
  amount: number;
  currency: string;
  paid_at: string | null;
};

export async function verifyTransaction(secret: string, reference: string): Promise<VerifiedTransaction> {
  return call(`/transaction/verify/${encodeURIComponent(reference)}`, { method: "GET" }, secret);
}
