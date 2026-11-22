export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function pct(n: number | string | null | undefined): string {
  if (n == null) return "—";
  return `${Math.round(Number(n))}%`;
}

/** e.g. "Sat 11 Jan, 3:40 PM" in Lagos time (the pilot market). */
export function formatDateTime(iso: string | null | undefined, timeZone = "Africa/Lagos"): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-NG", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
}

export function attemptStatusLabel(status: string | null | undefined, syncedLate?: boolean): string {
  switch (status) {
    case "submitted":
      return syncedLate ? "Submitted (answers synced late)" : "Submitted";
    case "auto_submitted":
      return syncedLate ? "Time up (answers synced late)" : "Time up";
    case "in_progress":
      return "Taking now";
    default:
      return "Not started";
  }
}
