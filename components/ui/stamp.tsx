export function Stamp({ children, tone = "pine" }: { children: string; tone?: "pine" | "gold" | "brick" }) {
  const color = tone === "gold" ? "border-gold text-gold" : tone === "brick" ? "border-brick text-brick" : "border-pine text-pine";
  return (
    <span className={`inline-block rotate-[-4deg] rounded-[3px] border-2 px-2 py-0.5 font-mono text-[0.7rem] font-semibold uppercase tracking-[0.1em] ${color}`}>
      {children}
    </span>
  );
}
