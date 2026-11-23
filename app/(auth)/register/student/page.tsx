import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { StudentSignupForm } from "./signup-form";
import { onlineCentreCode } from "@/lib/billing/online-centre";
import { CENTRE_CASH_PLAN, EARLY_ACCESS, ONLINE_PLAN, naira } from "@/lib/billing/plans";
import { Notice } from "@/components/ui/card";

export const metadata: Metadata = { title: "Join Verity" };

export default async function StudentSignupPage() {
  await connection(); // read ONLINE_CENTRE_CODE at request time, not build time
  const open = Boolean(onlineCentreCode());
  return (
    <>
      <h1 className="mb-2 font-serif text-3xl">Create your student account</h1>
      <p className="mb-6 text-lo">
        Your first test in one subject is free. After that, the Early Access pass is {naira(EARLY_ACCESS.plans[ONLINE_PLAN].amountKobo)} paid online
        for a full year of JAMB and WAEC practice. If your centre collects it, it’s {naira(EARLY_ACCESS.plans[CENTRE_CASH_PLAN].amountKobo)} through them.
      </p>
      {open ? <StudentSignupForm /> : <Notice>Signing up on your own opens soon. If you attend a tutorial centre, ask them for your sign-in slip.</Notice>}
      <p className="mt-6 text-sm text-lo">
        Already have a sign-in slip from your centre? <Link className="underline" href="/login">Sign in</Link>
      </p>
    </>
  );
}
