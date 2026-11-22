const TONES: Record<string, string> = {
  published: "border-pine text-pine",
  active: "border-pine text-pine",
  review: "border-gold text-gold",
  draft: "border-paper-line text-lo",
  archived: "border-paper-line text-lo",
  completed: "border-paper-line text-lo",
  flagged: "border-hi text-hi",
};

const LABELS: Record<string, string> = {
  review: "Waiting for review",
  published: "Published",
  draft: "Draft",
  archived: "Archived",
  flagged: "Flagged",
  active: "Open",
  completed: "Closed",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 font-mono text-[0.68rem] uppercase tracking-[0.06em] ${TONES[status] ?? "border-paper-line text-lo"}`}>
      {LABELS[status] ?? status}
    </span>
  );
}
