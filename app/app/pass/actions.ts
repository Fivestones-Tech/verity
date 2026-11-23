"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthError, authorizeStudent } from "@/lib/auth/session";
import { DomainError } from "@/lib/api";
import { startCheckout } from "@/lib/billing/service";

export type CheckoutState = { error: string | null };

/** Where Paystack should send the student back to. SITE_URL wins; otherwise this request's host. */
async function siteOrigin(): Promise<string> {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function checkoutAction(): Promise<CheckoutState> {
  let url: string;
  try {
    const ctx = await authorizeStudent();
    url = await startCheckout(ctx, await siteOrigin());
  } catch (e) {
    if (e instanceof AuthError || e instanceof DomainError) return { error: e.message };
    console.error("[pass] checkout", e);
    return { error: "We couldn't start the payment. Please try again." };
  }
  redirect(url);
}
