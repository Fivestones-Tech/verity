"use client";

import { Button } from "@/components/ui/button";

export type Slip = { full_name: string; student_number: string; class_name: string | null; password: string };

/** Printable sign-in slips. Passwords are shown once and never stored in readable form. */
export function LoginSlips({ slips, centreCode, centreName }: { slips: Slip[]; centreCode: string; centreName: string }) {
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3 print:hidden">
        <Button type="button" onClick={() => window.print()}>Print sign-in slips</Button>
        <p className="text-sm text-lo">Print or write these down now. For safety, Verity cannot show these passwords again. You can reset a password later.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 print:grid-cols-2">
        {slips.map((s) => (
          <div key={s.student_number} className="break-inside-avoid rounded-[3px] border border-paper-line bg-paper p-4">
            <div className="flex items-baseline justify-between">
              <span className="font-serif text-lg font-semibold">Verity</span>
              <span className="eyebrow">{centreName}</span>
            </div>
            <p className="mt-2 font-medium">{s.full_name}{s.class_name ? <span className="text-lo"> · {s.class_name}</span> : null}</p>
            <div className="doc-rule my-2" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="eyebrow">Centre code</dt><dd className="num text-base">{centreCode}</dd>
              <dt className="eyebrow">Student no.</dt><dd className="num text-base">{s.student_number}</dd>
              <dt className="eyebrow">Password</dt><dd className="num text-base tracking-widest">{s.password}</dd>
            </dl>
            <p className="mt-2 text-xs text-lo">Sign in at your centre’s Verity link. Keep this slip private.</p>
          </div>
        ))}
      </div>
    </div>
  );
}
