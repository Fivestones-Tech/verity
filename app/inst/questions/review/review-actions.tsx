"use client";

import { useActionState, useState } from "react";
import { reviewAction, type FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { inputClass, Label } from "@/components/ui/field";

export function ReviewActions({ questionId }: { questionId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(reviewAction, { error: null });
  const [sendBack, setSendBack] = useState(false);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="question_id" value={questionId} />
      <ul className="list-disc space-y-0.5 pl-5 text-sm text-lo">
        <li>Solve it yourself: is the marked answer really correct, and the only correct one?</li>
        <li>Is the wording clear, and are the wrong options believable?</li>
        <li>Is the topic and difficulty right? Does the explanation teach?</li>
      </ul>
      {sendBack && (
        <div>
          <Label htmlFor="note">What should the author fix?</Label>
          <textarea id="note" name="note" rows={3} className={inputClass} required />
        </div>
      )}
      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex flex-wrap gap-3">
        {!sendBack ? (
          <>
            <Button name="decision" value="approve" disabled={pending}>Approve and publish</Button>
            <Button type="button" variant="ghost" onClick={() => setSendBack(true)}>Send back</Button>
          </>
        ) : (
          <>
            <Button name="decision" value="send_back" variant="ghost" disabled={pending}>Send back to author</Button>
            <Button type="button" variant="ghost" onClick={() => setSendBack(false)}>Cancel</Button>
          </>
        )}
      </div>
    </form>
  );
}
