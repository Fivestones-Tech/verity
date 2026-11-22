"use client";

import { useActionState } from "react";
import { registerInstitution, type RegisterState } from "./actions";
import { Field, SelectField } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";

export function RegisterForm({ needsCode }: { needsCode: boolean }) {
  const [state, action, pending] = useActionState<RegisterState, FormData>(registerInstitution, { error: null });
  return (
    <form action={action} className="space-y-4">
      <Field label="Centre name" id="centre_name" required />
      <Field label="Centre code" id="centre_code" required maxLength={12} autoCapitalize="characters" hint="Students type this when they sign in. Letters and numbers only, e.g. BRIGHTSTAR." />
      <SelectField label="Type" id="type" defaultValue="tutorial_centre">
        <option value="tutorial_centre">Tutorial centre</option>
        <option value="school">School</option>
      </SelectField>
      <SelectField label="Exams you prepare students for" id="exam_focus" defaultValue="jamb_only">
        <option value="jamb_only">JAMB only</option>
        <option value="waec_only">WAEC only</option>
        <option value="both">JAMB and WAEC</option>
      </SelectField>
      <div className="doc-rule pt-4" />
      <Field label="Your full name" id="full_name" required autoComplete="name" />
      <Field label="Your email" id="email" type="email" required autoComplete="email" />
      <Field label="Password" id="password" type="password" required minLength={8} autoComplete="new-password" />
      {needsCode && <Field label="Pilot access code" id="signup_code" required hint="From the Verity team." />}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Setting up…" : "Create centre"}
      </Button>
    </form>
  );
}
