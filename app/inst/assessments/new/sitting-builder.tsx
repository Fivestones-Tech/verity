"use client";

import { useActionState, useState } from "react";
import { createSittingAction, type BuilderState } from "../actions";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { inputClass, Label } from "@/components/ui/field";
import { JAMB_SITTING } from "@/lib/assessments/kinds";

export type SittingSubject = { id: string; name: string; published: number; takers: number; english: boolean };

/** Full JAMB mock: English + each student's 3 subjects in one sitting. */
export function SittingBuilder({ subjects, students, ready, classes }: { subjects: SittingSubject[]; students: number; ready: number; classes: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<BuilderState, FormData>(createSittingAction, { error: null });
  const [assign, setAssign] = useState<string[]>(["all"]);
  const [endLocal, setEndLocal] = useState("");
  const [eng, setEng] = useState<number>(JAMB_SITTING.englishQuestions);
  const [other, setOther] = useState<number>(JAMB_SITTING.otherQuestions);
  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const needed = subjects.filter((s) => s.english || s.takers > 0);
  const short = needed.filter((s) => s.published < (s.english ? eng : other));

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="end_at_iso" value={endLocal ? new Date(endLocal).toISOString() : ""} />
      <Card>
        <p className="eyebrow mb-3">1 · Subjects</p>
        <p>Each student sits English plus their own 3 JAMB subjects, in one timed sitting, like the real exam.</p>
        {ready < students && (
          <div className="mt-3">
            <Notice>
              <span className="num">{students - ready}</span> of <span className="num">{students}</span> students don’t have their 3 subjects set yet, so they can’t take this mock. Set them on the Students page.
            </Notice>
          </div>
        )}
        {needed.length > 0 ? (
          <table className="grid-table mt-3 text-sm">
            <thead><tr><th>Subject</th><th className="text-right">Students</th><th className="text-right">Published questions</th></tr></thead>
            <tbody>
              {needed.map((s) => (
                <tr key={s.id}>
                  <td>{s.name}</td>
                  <td className="n">{s.english ? ready : s.takers}</td>
                  <td className="n">{s.published}{s.published < (s.english ? eng : other) && <span className="text-lo"> (needs {s.english ? eng : other})</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="mt-3 text-sm text-lo">No students have their subjects set yet.</p>
        )}
      </Card>

      <Card>
        <p className="eyebrow mb-3">2 · Questions and time</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="english_questions">English questions</Label>
            <input id="english_questions" name="english_questions" type="number" min={1} max={60} value={eng} onChange={(e) => setEng(Number(e.target.value))} required className={`${inputClass} num`} />
          </div>
          <div>
            <Label htmlFor="other_questions">Questions per other subject</Label>
            <input id="other_questions" name="other_questions" type="number" min={1} max={40} value={other} onChange={(e) => setOther(Number(e.target.value))} required className={`${inputClass} num`} />
          </div>
          <div>
            <Label htmlFor="duration_minutes">Time allowed (minutes)</Label>
            <input id="duration_minutes" name="duration_minutes" type="number" min={1} max={240} defaultValue={JAMB_SITTING.minutes} required className={`${inputClass} num`} />
          </div>
        </div>
        <p className="mt-2 text-sm text-lo">
          The real exam is <span className="num">60</span> English and <span className="num">40</span> per subject (<span className="num">180</span> questions) in <span className="num">2</span> hours. Each student answers <span className="num">{eng + 3 * other}</span>.
        </p>
        {short.length > 0 && (
          <p className="mt-2 text-sm">
            Not enough published questions yet for {short.map((s) => s.name).join(", ")}.
            {short.some((s) => s.english) ? " English is needed for every student, so publish more English questions or lower the number." : " Those subjects will be left out, and students who take them can’t sit this mock. Publish more, or lower the numbers above."}
          </p>
        )}
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
        <Label htmlFor="name">Mock name</Label>
        <input id="name" name="name" defaultValue="Full JAMB mock" required className={inputClass} />
        <div className="mt-4">
          <Label htmlFor="instructions">Instructions for students (optional)</Label>
          <textarea id="instructions" name="instructions" rows={2} className={inputClass} placeholder="e.g. Answer English first. Calculators allowed." />
        </div>
      </Card>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      <div className="flex flex-wrap gap-3">
        <Button name="open_now" value="1" variant="gold" disabled={pending || ready === 0}>{pending ? "Creating…" : "Create and open now"}</Button>
        <Button name="open_now" value="0" variant="ghost" disabled={pending || ready === 0}>Save as draft</Button>
      </div>
    </form>
  );
}
