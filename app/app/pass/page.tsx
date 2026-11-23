import type { Metadata } from "next";
import { requireStudentPage } from "@/lib/auth/session";
import { formatDay, loadPassSummary } from "@/lib/student/pass";
import { Card, Notice } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PayButton } from "./pay-button";

export const metadata: Metadata = { title: "Early Access pass" };

export default async function PassPage() {
  const ctx = await requireStudentPage();
  const s = await loadPassSummary(ctx);

  const online = s.canPayOnline ? (
    <>
      <PayButton label={`Pay ${s.onlinePrice} online`} />
      <p className="mt-3 text-xs text-lo">You’ll pay on Paystack’s secure page by card, bank transfer or USSD. Verity never sees your card details.</p>
    </>
  ) : (
    <Notice>Online payment isn’t switched on yet. Please check back soon.</Notice>
  );

  return (
    <div className="mx-auto max-w-xl">
      <p className="eyebrow">Early Access</p>
      <h1 className="mt-1 font-serif text-3xl">Your Verity pass</h1>

      {s.pass ? (
        <Card className="mt-5 border-pine">
          <p className="eyebrow text-pine">Active</p>
          <p className="mt-1 font-serif text-xl">JAMB and WAEC practice until {formatDay(s.pass.ends_at)}</p>
          <p className="mt-2 text-sm text-lo">Every test your teachers open for you is unlocked, including full JAMB mocks.</p>
          <div className="mt-4"><ButtonLink href="/app">Go to my tests</ButtonLink></div>
        </Card>
      ) : (
        <>
          <Card className="mt-5">
            <p className="font-serif text-xl">One payment. A full year of JAMB and WAEC practice.</p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-lo">
              <li>Every topic test and mock, including the full JAMB sitting out of 400</li>
              <li>Your score, the topics to work on, and worked answers after each test</li>
              <li>Lasts one year from the day it starts</li>
            </ul>
            <p className="mt-3 text-sm text-lo">
              {s.trialUsed ? "You’ve used your free test." : "Your first test in one subject is free."} Early Access prices last until {formatDay(s.offerEndsAt)}.
            </p>
          </Card>

          {!s.offerOpen ? (
            <div className="mt-5"><Notice>The Early Access offer has ended. New prices are coming soon.</Notice></div>
          ) : s.centreName ? (
            <div className="mt-5 grid gap-4">
              <Card>
                <p className="eyebrow">Through your centre</p>
                <p className="num mt-1 text-3xl">{s.centrePrice}</p>
                <p className="mt-2 text-sm text-lo">Pay {s.centrePrice} to {s.centreName}. Once they’ve paid Verity, your pass turns on here.</p>
              </Card>
              <Card>
                <p className="eyebrow">Pay online yourself</p>
                <p className="num mt-1 text-3xl">{s.onlinePrice}</p>
                <p className="mb-3 mt-2 text-sm text-lo">Starts straight away. No need to wait for your centre.</p>
                {online}
              </Card>
            </div>
          ) : (
            <Card className="mt-5">
              <p className="num text-3xl">{s.onlinePrice}</p>
              <p className="mb-3 mt-1 text-sm text-lo">Paid once, online.</p>
              {online}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
