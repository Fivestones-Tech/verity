"use client";

import { useActionState } from "react";
import { addStaffAction, createClassAction, type SimpleState } from "./actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Field, SelectField } from "@/components/ui/field";

export function CreateClassForm() {
  const [s, action, pending] = useActionState<SimpleState, FormData>(createClassAction, { error: null });
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
      <Field label="New class name" id="name" placeholder="e.g. JAMB Batch A" required />
      <Button disabled={pending}>Create class</Button>
      {s.error && <div className="sm:col-span-2"><Notice tone="error">{s.error}</Notice></div>}
      {s.done && <div className="sm:col-span-2"><Notice tone="success">{s.done}</Notice></div>}
    </form>
  );
}

export function AddStaffForm({ canAddAdmin }: { canAddAdmin: boolean }) {
  const [s, action, pending] = useActionState<SimpleState, FormData>(addStaffAction, { error: null });
  return (
    <div className="space-y-3">
      <form action={action} className="grid gap-3 sm:grid-cols-[1.4fr_1.4fr_1fr_auto] sm:items-end">
        <Field label="Full name" id="full_name" required />
        <Field label="Email" id="email" type="email" required />
        <SelectField label="Role" id="role" defaultValue="teacher">
          <option value="teacher">Teacher</option>
          {canAddAdmin && <option value="admin">Admin</option>}
        </SelectField>
        <Button disabled={pending}>Add</Button>
      </form>
      {s.error && <Notice tone="error">{s.error}</Notice>}
      {s.done && (
        <Notice tone="success">
          {s.done} Their first password is <span className="num font-semibold tracking-widest">{s.password}</span>. Give it to them privately; it won’t be shown again.
        </Notice>
      )}
    </div>
  );
}
