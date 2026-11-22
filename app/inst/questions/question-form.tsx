"use client";

import { useActionState, useMemo, useState } from "react";
import { saveQuestionAction, type FormState } from "./actions";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { inputClass, Label, SelectField } from "@/components/ui/field";

type Subject = { id: string; name: string; exam_code: string };
type Topic = { id: string; subject_id: string; name: string; parent_name: string | null };

export type QuestionDefaults = {
  id?: string;
  subject_id?: string;
  topic_id?: string;
  question_text?: string;
  options?: { A: string; B: string; C: string; D: string };
  correct_option?: string;
  difficulty?: string;
  explanation?: string;
  source?: string;
};

export function QuestionForm({ subjects, topics, defaults = {} }: { subjects: Subject[]; topics: Topic[]; defaults?: QuestionDefaults }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveQuestionAction, { error: null });
  const [subjectId, setSubjectId] = useState(defaults.subject_id ?? subjects[0]?.id ?? "");
  const [topicId, setTopicId] = useState(defaults.topic_id ?? "");
  const subjectTopics = useMemo(() => topics.filter((t) => t.subject_id === subjectId), [topics, subjectId]);
  const fe = state.fieldErrors ?? {};

  return (
    <form action={action} className="space-y-5">
      {defaults.id && <input type="hidden" name="question_id" value={defaults.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Subject" id="subject_id" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(""); }}>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.exam_code} · {s.name}</option>
          ))}
        </SelectField>
        <div>
          <SelectField label="Topic" id="topic_id" value={topicId} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">New topic…</option>
            {subjectTopics.map((t) => (
              <option key={t.id} value={t.id}>{t.parent_name ? `${t.parent_name} › ${t.name}` : t.name}</option>
            ))}
          </SelectField>
          {!topicId && (
            <input name="new_topic" aria-label="New topic name" placeholder="Type the topic name" className={`${inputClass} mt-2`} />
          )}
          {fe.topic_id && <p className="mt-1 text-sm">⚠ {fe.topic_id}</p>}
        </div>
      </div>

      <div>
        <Label htmlFor="question_text">Question</Label>
        <textarea id="question_text" name="question_text" required rows={4} defaultValue={defaults.question_text} className={inputClass} />
        {fe.question_text && <p className="mt-1 text-sm">⚠ Question text is required</p>}
      </div>

      <fieldset className="space-y-3">
        <legend className="eyebrow mb-1">Options · tick the correct answer</legend>
        {(["A", "B", "C", "D"] as const).map((k) => (
          <div key={k} className="flex items-center gap-3">
            <input
              type="radio"
              name="correct_option"
              value={k}
              required
              defaultChecked={defaults.correct_option === k}
              aria-label={`Option ${k} is correct`}
              className="h-5 w-5 shrink-0 accent-[var(--pine)]"
            />
            <span className="num w-5">{k}</span>
            <input name={`option_${k.toLowerCase()}`} required defaultValue={defaults.options?.[k]} aria-label={`Option ${k}`} className={inputClass} />
          </div>
        ))}
        {fe.option_a && <p className="text-sm">⚠ {fe.option_a}</p>}
        {fe.correct_option && <p className="text-sm">⚠ Tick the correct option</p>}
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Difficulty" id="difficulty" defaultValue={defaults.difficulty ?? "moderate"}>
          <option value="easy">Easy</option>
          <option value="moderate">Moderate</option>
          <option value="difficult">Difficult</option>
        </SelectField>
        <SelectField label="Source" id="source" defaultValue={defaults.source ?? "original"}>
          <option value="original">Original (written by our teachers)</option>
          <option value="expert_created">Expert created</option>
          <option value="institution">Institution</option>
          <option value="licensed">Licensed</option>
        </SelectField>
      </div>

      <div>
        <Label htmlFor="explanation">Explanation (shown to students after the test)</Label>
        <textarea id="explanation" name="explanation" rows={3} defaultValue={defaults.explanation} className={inputClass} />
      </div>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save and send for review"}</Button>
      </div>
      <p className="text-sm text-lo">Saving sends the question to review. Another teacher must approve it before students see it.</p>
    </form>
  );
}
