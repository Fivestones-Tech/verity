"use client";

import { useActionState } from "react";
import { registerStudent, type StudentSignupState } from "./actions";
import { Field } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";

export function StudentSignupForm() {
  const [state, action, pending] = useActionState<StudentSignupState, FormData>(registerStudent, { error: null });
  return (
    <form action={action} className="space-y-4">
      <Field label="Your full name" id="full_name" required autoComplete="name" />
      <Field label="Your email" id="email" type="email" required autoComplete="email" hint="You’ll sign in with this. Paystack sends your receipt here." />
      <Field label="Password" id="password" type="password" required minLength={8} autoComplete="new-password" />
      <Field label="Centre code (optional)" id="centre_code" maxLength={20} autoCapitalize="characters" hint="Attend a tutorial centre? Type its code and they’ll add you to their tests. Leave empty if you don’t." />
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating your account…" : "Create my account"}
      </Button>
    </form>
  );
}
