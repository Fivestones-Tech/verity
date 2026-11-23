"use client";

import { useActionState } from "react";
import { grantPassesAction, type GrantState } from "../../actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";

type Row = { id: string; full_name: string; student_number: string | null; pass: { ends_at: string; source: string } | null };

const SOURCE: Record<string, string> = { centre_cash: "Centre paid", free_pilot: "Free (pilot)", online_payment: "Paid online" };

function until(iso: string) {
  return new Intl.DateTimeFormat("en-NG", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Lagos" }).format(new Date(iso));
}

export function GrantForm({ institutionId, students, withoutPass }: { institutionId: string; students: Row[]; withoutPass: number }) {
  const [state, action, pending] = useActionState<GrantState, FormData>(grantPassesAction, { error: null, done: null });
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="institution_id" value={institutionId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="How did they pay?" id="source" defaultValue="centre_cash">
          <option value="centre_cash">Centre paid cash (₦500 each)</option>
          <option value="free_pilot">Free pass (pilot, ₦0)</option>
        </SelectField>
        <Field label="Note (optional)" id="note" maxLength={200} placeholder="e.g. Paid 23 Nov, receipt 014" />
      </div>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.done && <Notice tone="success">{state.done}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="scope" value="selected" disabled={pending}>Turn on for ticked students</Button>
        {withoutPass > 0 && (
          <Button type="submit" name="scope" value="all_without" variant="ghost" disabled={pending}>
            Turn on for all {withoutPass} without a pass
          </Button>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="grid-table text-sm">
          <thead><tr><th><span className="sr-only">Tick</span></th><th>Student</th><th>Number</th><th>Pass</th></tr></thead>
          <tbody>
            {students.map((s) => (
              <tr key={s.id}>
                <td>
                  {!s.pass && (
                    <input type="checkbox" name="student_id" value={s.id} aria-label={`Turn on pass for ${s.full_name}`} className="h-5 w-5 accent-[var(--color-pine)]" />
                  )}
                </td>
                <td>{s.full_name}</td>
                <td className="num">{s.student_number ?? "—"}</td>
                <td>{s.pass ? `Active until ${until(s.pass.ends_at)} · ${SOURCE[s.pass.source] ?? s.pass.source}` : "Free trial"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
}
