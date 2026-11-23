"use client";

import { useActionState } from "react";
import { checkoutAction, type CheckoutState } from "./actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";

export function PayButton({ label }: { label: string }) {
  const [state, action, pending] = useActionState<CheckoutState>(checkoutAction, { error: null });
  return (
    <form action={action} className="space-y-3">
      <Button type="submit" variant="gold" disabled={pending} className="w-full sm:w-auto">
        {pending ? "Opening payment…" : label}
      </Button>
      {state.error && <Notice tone="error">{state.error}</Notice>}
    </form>
  );
}
