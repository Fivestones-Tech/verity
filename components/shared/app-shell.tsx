import type { ReactNode } from "react";
import { Wordmark } from "@/components/ui/wordmark";
import { NavLinks } from "./nav-links";

export function AppShell({
  links,
  who,
  children,
}: {
  links: { href: string; label: string }[];
  who: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="bg-ink text-ink-hi print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 pt-3">
          <Wordmark onDark />
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-ink-lo sm:inline">{who}</span>
            <form action="/auth/sign-out" method="post">
              <button className="min-h-11 font-mono text-[0.72rem] uppercase tracking-[0.06em] text-ink-lo hover:text-ink-hi">Sign out</button>
            </form>
          </div>
        </div>
        <div className="mx-auto max-w-5xl px-4 pb-2 pt-2">
          <NavLinks links={links} />
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">{children}</main>
      <footer className="mx-auto w-full max-w-5xl px-4 pb-6 text-xs text-lo print:hidden">© Lumio. Verity is a Lumio product.</footer>
    </div>
  );
}
