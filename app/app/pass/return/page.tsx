import type { Metadata } from "next";
import { requireStudentPage } from "@/lib/auth/session";
import { confirmOwnPayment } from "@/lib/billing/service";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Payment" };

/**
 * Paystack sends the student here after checkout. We never trust the redirect itself:
 * confirmOwnPayment() asks Paystack's verify API before anything is turned on.
 */
export default async function PassReturnPage({ searchParams }: PageProps<"/app/pass/return">) {
  const ctx = await requireStudentPage();
  const sp = await searchParams;
  const ref = typeof sp.reference === "string" ? sp.reference.slice(0, 64) : typeof sp.trxref === "string" ? sp.trxref.slice(0, 64) : "";
  const outcome = ref ? await confirmOwnPayment(ctx, ref) : "not_found";

  const copy = {
    success: { title: "Your pass is on", body: "Thank you. You now have a full year of JAMB and WAEC practice.", cta: "Go to my tests", href: "/app" },
    pending: { title: "We’re confirming your payment", body: "This usually takes a minute. Refresh this page shortly. If you were charged, your pass will turn on by itself.", cta: "Back to my pass", href: "/app/pass" },
    failed: { title: "The payment didn’t go through", body: "You haven’t been charged for a pass. You can try again.", cta: "Try again", href: "/app/pass" },
    not_found: { title: "We couldn’t find that payment", body: "If you were charged, your pass will turn on by itself once the payment is confirmed.", cta: "Back to my pass", href: "/app/pass" },
  }[outcome];

  return (
    <div className="mx-auto max-w-xl">
      <Card className={outcome === "success" ? "border-pine" : ""}>
        <h1 className="font-serif text-2xl">{copy.title}</h1>
        <p className="mt-2 text-lo">{copy.body}</p>
        <div className="mt-4"><ButtonLink href={copy.href} variant={outcome === "success" ? "gold" : "primary"}>{copy.cta}</ButtonLink></div>
      </Card>
    </div>
  );
}
