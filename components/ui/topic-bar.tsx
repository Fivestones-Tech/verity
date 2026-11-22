import { topicBand, type Band } from "@/lib/scoring/next-step";

const LABEL: Record<Band, string> = {
  needs_attention: "Needs attention",
  developing: "Developing",
  good: "Good",
  strong: "Strong",
  not_enough_evidence: "Not enough questions yet",
};

export function bandLabel(b: Band) {
  return LABEL[b];
}

/** Topic label + thin fill bar + mono percentage. Weak topics use brick (docs/10). */
export function TopicBar({ name, percentage, questions, detail }: { name: string; percentage: number; questions: number; detail?: string }) {
  const band = topicBand(percentage, questions);
  const weak = band === "needs_attention";
  return (
    <div className="py-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium">{name}</span>
        <span className="num text-sm">{Math.round(percentage)}%</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-paper-line" aria-hidden>
        <div className={`h-full ${weak ? "bg-brick" : "bg-pine"}`} style={{ width: `${Math.max(0, Math.min(100, percentage))}%` }} />
      </div>
      <p className="mt-1 text-xs text-lo">
        <span className={weak ? "text-brick font-medium" : ""}>{LABEL[band]}</span>
        {detail ? <> · <span className="num">{detail}</span></> : null}
      </p>
    </div>
  );
}
