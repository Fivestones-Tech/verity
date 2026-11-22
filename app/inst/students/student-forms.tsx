"use client";

import { useActionState } from "react";
import { addStudentAction, resetPasswordAction, type SlipState } from "./actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";
import { LoginSlips } from "@/components/institution/login-slips";

export function AddStudentForm({ classes, centreCode, centreName }: { classes: { id: string; name: string }[]; centreCode: string; centreName: string }) {
  const [state, action, pending] = useActionState<SlipState, FormData>(addStudentAction, { error: null });
  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
        <Field label="Full name" id="full_name" required />
        <Field label="Student number" id="student_number" required autoCapitalize="characters" />
        <SelectField label="Class" id="class_id" defaultValue="">
          <option value="">No class</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </SelectField>
        <Button type="submit" disabled={pending}>{pending ? "Adding…" : "Add"}</Button>
      </form>
      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.slips && <LoginSlips slips={state.slips} centreCode={centreCode} centreName={centreName} />}
    </div>
  );
}

export function ResetPasswordButton({ studentId, centreCode, centreName }: { studentId: string; centreCode: string; centreName: string }) {
  const [state, action, pending] = useActionState<SlipState, FormData>(resetPasswordAction, { error: null });
  if (state.slips) return <div className="mt-2"><LoginSlips slips={state.slips} centreCode={centreCode} centreName={centreName} /></div>;
  return (
    <form action={action}>
      <input type="hidden" name="student_id" value={studentId} />
      <button disabled={pending} className="min-h-11 text-sm text-pine underline">{pending ? "Resetting…" : "Reset password"}</button>
      {state.error && <p className="text-sm">⚠ {state.error}</p>}
    </form>
  );
}
