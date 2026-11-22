import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { WipeDevice } from "./wipe-device";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  return (
    <>
      {sp.signed_out === "1" && <WipeDevice />}
      <h1 className="mb-6 font-serif text-3xl">Sign in</h1>
      <LoginForm />
      <p className="mt-8 text-sm text-lo">
        Setting up a tutorial centre or school?{" "}
        <Link href="/register/institution" className="text-pine underline">
          Register your centre
        </Link>
      </p>
    </>
  );
}
