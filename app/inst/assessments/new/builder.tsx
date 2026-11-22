"use client";

import { useActionState, useMemo, useState } from "react";
import { createAssessmentAction, type BuilderState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { inputClass, Label, SelectField } from "@/components/ui/field";
import { mockDefaults, type TestKind } from "@/lib/assessments/kinds";

type Subject = { id: string; name: string; code: string; exam_code: string };
type Topic = { id: string; subject_id: string; name: string; published: number };

export function Builder({ kind, subjects, topics, classes }: { kind: TestKind; subjects: Subject[]; topics: Topic[]; classes: { id: string; name: string }[] }) {
  const isMock = kind === "mock";
  const [state, action, pending] = useActionState<BuilderState, FormData>(createAssessmentAction, { error: null });
  const withQuestions = subjects.filter((s) => topics.some((t) => t.subject_id === s.id && t.published > 0));
  const [subjectId, setSubjectId] = useState(withQuestions[0]?.id ?? "");
  const [chosen, setChosen] = useState<string[]>([]);
  const [assign, setAssign] = useState<string[]>(["all"]);
  const [endLocal, setEndLocal] = useState("");
  const subjectTopics = useMemo(() => topics.filter((t) => t.subject_id === subjectId && t.published > 0), [topics, subjectId]);
  const available = subjectTopics.filter((t) => isMock || chosen.includes(t.id)).reduce((n, t) => n + t.published, 0);
  const subject = subjects.find((s) => s.id === subjectId);
  const defaults = isMock && subject ? mockDefaults(subject.exam_code, subject.code) : { questions: 20, minutes: 20 };
  const suggested = !subject
    ? ""
    : isMock
      ? `${subject.name} mock`
      : `${subject.name}: ${subjectTopics.filter((t) => chosen.includes(t.id)).map((t) => t.name).join(", ") || "topic test"}`;
  const ready = isMock ? available > 0 : chosen.length > 0;

  if (withQuestions.length === 0) {
    return <Notice>There are no published questions yet. Import questions and have another teacher approve them, then come back to build a test.</Notice>;
  }

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="end_at_iso" value={endLocal ? new Date(endLocal).toISOString() : ""} />
      <Card>
        <p className="eyebrow mb-3">{isMock ? "1 · Subject" : "1 · Subject and topics"}</p>
        <SelectField label="Subject" id="subject_id" value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setChosen([]); }}>
          {withQuestions.map((s) => <option key={s.id} value={s.id}>{s.exam_code} · {s.name}</option>)}
        </SelectField>
        {isMock ? (
          <div className="mt-4">
            <p>A mock covers the whole syllabus. Questions are spread across every topic that has published questions.</p>
            <ul className="mt-2 grid gap-1 text-sm sm:grid-cols-2">
              {subjectTopics.map((t) => <li key={t.id}>{t.name} <span className="num text-lo">({t.published})</span></li>)}
            </ul>
          </div>
        ) : (
        <fieldset className="mt-4">
          <legend className="eyebrow mb-2">Topics (published questions in brackets)</legend>
          <div className="grid gap-1 sm:grid-cols-2">
            {subjectTopics.map((t) => (
              <label key={t.id} className="flex min-h-11 items-center gap-3">
                <input type="checkbox" name="topic_ids" value={t.id} checked={chosen.includes(t.id)} onChange={() => setChosen(toggle(chosen, t.id))} className="h-5 w-5 accent-[var(--pine)]" />
                <span>{t.name} <span className="num text-lo">({t.published})</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        )}
      </Card>

      <Card>
        <p className="eyebrow mb-3">2 · Questions and time</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="question_count">Number of questions</Label>
            <input id="question_count" name="question_count" type="number" min={1} max={Math.max(1, available)} key={`q-${subjectId}`} defaultValue={Math.min(defaults.questions, Math.max(1, available))} required className={`${inputClass} num`} />
            <p className="mt-1 text-sm text-lo"><span className="num">{available}</span> available {isMock ? `in ${subject?.name ?? "this subject"}` : "in the chosen topics"}</p>
            {isMock && available < defaults.questions && (
              <p className="mt-1 text-sm text-lo">A full paper has <span className="num">{defaults.questions}</span> questions. Publish more to reach it.</p>
            )}
          </div>
          <div>
            <Label htmlFor="duration_minutes">Time allowed (minutes)</Label>
            <input id="duration_minutes" name="duration_minutes" type="number" min={1} max={240} key={`m-${subjectId}`} defaultValue={defaults.minutes} required className={`${inputClass} num`} />
          </div>
        </div>
        <fieldset className="mt-4">
          <legend className="eyebrow mb-2">Difficulty (leave all unticked for a mix)</legend>
          <div className="flex flex-wrap gap-4">
            {["easy", "moderate", "difficult"].map((d) => (
              <label key={d} className="flex min-h-11 items-center gap-2"><input type="checkbox" name="difficulties" value={d} className="h-5 w-5 accent-[var(--pine)]" /> {d}</label>
            ))}
          </div>
        </fieldset>
        <p className="mt-2 text-sm text-lo">{isMock && <>Defaults follow the real exam paper. </>}Questions are picked at random from published questions, spread evenly across the topics. Each student gets the questions and options in a different order.</p>
      </Card>

      <Card>
        <p className="eyebrow mb-3">3 · Who takes it</p>
        <div className="grid gap-1 sm:grid-cols-2">
          <label className="flex min-h-11 items-center gap-3">
            <input type="checkbox" name="assign_to" value="all" checked={assign.includes("all")} onChange={() => setAssign(assign.includes("all") ? [] : ["all"])} className="h-5 w-5 accent-[var(--pine)]" />
            All students at the centre
          </label>
          {classes.map((c) => (
            <label key={c.id} className="flex min-h-11 items-center gap-3">
              <input type="checkbox" name="assign_to" value={c.id} disabled={assign.includes("all")} checked={assign.includes(c.id)} onChange={() => setAssign(toggle(assign, c.id))} className="h-5 w-5 accent-[var(--pine)]" />
              {c.name}
            </label>
          ))}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="end_at">Closes at (optional)</Label>
            <input id="end_at" type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} className={inputClass} />
          </div>
        </div>
      </Card>

      <Card>
        <p className="eyebrow mb-3">4 · Name and publish</p>
        <Label htmlFor="name">{isMock ? "Mock name" : "Test name"}</Label>
        <input id="name" name="name" key={suggested} defaultValue={suggested} required className={inputClass} />
        <div className="mt-4">
          <Label htmlFor="instructions">Instructions for students (optional)</Label>
          <textarea id="instructions" name="instructions" rows={2} className={inputClass} placeholder="e.g. Work alone. Calculators allowed." />
        </div>
      </Card>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button name="open_now" value="1" variant="gold" disabled={pending || !ready}>{pending ? "Creating…" : "Create and open now"}</Button>
        <Button name="open_now" value="0" variant="ghost" disabled={pending || !ready}>Save as draft</Button>
      </div>
    </form>
  );
}
