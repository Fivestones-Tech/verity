"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/** Warns if this device holds answers for a test that hasn't reached the server yet. */
export function LocalProgressNotice() {
  const [pending, setPending] = useState<{ assessmentId: string; name: string } | null>(null);
  useEffect(() => {
    let off = false;
    import("@/lib/offline/store")
      .then(async (s) => {
        const all = await (await s.db()).getAll("attempts");
        const open = all.find((a) => a.serverStatus === "in_progress");
        if (open && !off) setPending({ assessmentId: open.assessmentId, name: open.assessmentName });
      })
      .catch(() => {});
    return () => {
      off = true;
    };
  }, []);
  if (!pending) return null;
  return (
    <div role="status" className="mb-4 rounded-[3px] border-l-4 border-gold bg-paper-soft px-4 py-3 text-sm">
      This device has saved answers for <strong>{pending.name}</strong>.{" "}
      <Link className="underline" href={`/app/assessments/${pending.assessmentId}/take`}>Open it</Link> while online so they reach your teacher. Don’t sign out until it says Synced.
    </div>
  );
}
