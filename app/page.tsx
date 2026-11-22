import { redirect } from "next/navigation";
import { getUserId, homeFor } from "@/lib/auth/session";

export default async function Home() {
  const userId = await getUserId();
  redirect(userId ? await homeFor(userId) : "/login");
}
