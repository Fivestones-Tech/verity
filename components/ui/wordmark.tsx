/** Verity wordmark. On dark backgrounds it sits in a paper chip (docs/10). */
export function Wordmark({ onDark = false }: { onDark?: boolean }) {
  const mark = (
    <span className="inline-flex items-center gap-1.5">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path d="M3 12.5l5.5 5.5L21 5.5" fill="none" stroke="var(--pine)" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="20" cy="18" r="2.2" fill="var(--gold)" />
      </svg>
      <span className="font-serif text-lg font-semibold tracking-tight text-hi">Verity</span>
    </span>
  );
  return onDark ? <span className="rounded-full bg-paper px-3 py-1">{mark}</span> : mark;
}
