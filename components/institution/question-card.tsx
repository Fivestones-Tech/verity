import type { FullQuestion } from "@/lib/questions/load";
import { StatusBadge } from "@/components/ui/status-badge";

export function QuestionCard({ q }: { q: FullQuestion }) {
  return (
    <article className="rounded-[3px] border border-paper-line bg-paper-soft p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2 text-sm text-lo">
        <span>{q.subject?.name}</span>·<span>{q.topic?.name}</span>·<span>{q.difficulty}</span>
        <span className="ml-auto"><StatusBadge status={q.status} /></span>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-lg">{q.question_text}</p>
      <ul className="mt-4 space-y-2">
        {q.options.map((o) => (
          <li key={o.option_key} className={`flex gap-3 rounded-[3px] border px-3 py-2 ${o.is_correct ? "border-pine bg-paper" : "border-paper-line"}`}>
            <span className="num">{o.option_key}</span>
            <span className="flex-1">{o.option_text}</span>
            {o.is_correct && <span className="font-mono text-xs uppercase text-pine">Correct</span>}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        <p className="eyebrow">Explanation</p>
        <p className="mt-1 whitespace-pre-wrap">{q.explanation || <span className="text-lo">No explanation yet.</span>}</p>
      </div>
      <p className="mt-4 text-xs text-lo">
        Written by {q.author?.full_name || "a teacher"} · source: {q.source} · version <span className="num">{q.version}</span>
      </p>
    </article>
  );
}
