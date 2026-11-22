"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";

export function LoginForm() {
  const [mode, setMode] = useState<"student" | "staff">("student");
  const [state, action, pending] = useActionState<LoginState, FormData>(login, { error: null });

  return (
    <div>
      <div role="tablist" aria-label="Who is signing in" className="mb-6 grid grid-cols-2 rounded-full border border-paper-line p-1">
        {(["student", "staff"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            type="button"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`min-h-10 rounded-full font-mono text-xs uppercase tracking-[0.06em] ${mode === m ? "bg-pine text-ink-hi" : "text-lo"}`}
          >
            {m === "student" ? "Student" : "Teacher / admin"}
          </button>
        ))}
      </div>

      <form action={action} className="space-y-4">
        <input type="hidden" name="mode" value={mode} />
        {mode === "student" ? (
          <>
            <Field label="Centre code" id="centre" autoCapitalize="characters" autoComplete="organization" required placeholder="e.g. BRIGHTSTAR" />
            <Field label="Student number" id="number" autoCapitalize="characters" autoComplete="username" required />
          </>
        ) : (
          <Field label="Email" id="email" type="email" autoComplete="email" required />
        )}
        <Field label="Password" id="password" type="password" autoComplete="current-password" required />
        {state.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      {mode === "student" && (
        <p className="mt-4 text-sm text-lo">Your centre gives you your student number and password. Lost them? Ask your teacher to reset your password.</p>
      )}
    </div>
  );
}
