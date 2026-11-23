import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Landing } from "@/components/marketing/landing";
import { getUserId, homeFor } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: { absolute: "Verity · Exam readiness for JAMB and WAEC" },
  description:
    "Timed topic tests and full JAMB mocks that show students what to practise next, and show tutorial centres who needs help with what.",
};

/** Signed-in users go straight to their home; everyone else sees the landing page. */
export default async function Home() {
  const userId = await getUserId();
  if (userId) redirect(await homeFor(userId));
  return <Landing />;
}
