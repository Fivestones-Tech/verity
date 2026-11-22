import { ButtonLink } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="font-serif text-3xl">You don’t have access to this page</h1>
      <p className="mt-3 text-lo">This account can’t open that part of Verity. If you think it should, ask your centre admin.</p>
      <form action="/auth/sign-out" method="post" className="mt-6">
        <button className="text-pine underline">Sign out</button>
      </form>
      <div className="mt-6">
        <ButtonLink href="/login" variant="ghost">Back to sign in</ButtonLink>
      </div>
    </main>
  );
}
