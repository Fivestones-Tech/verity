import type { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[3px] border border-paper-line bg-paper-soft p-4 sm:p-5 ${className}`}>{children}</section>;
}

export function PageHeader({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="rounded-[3px] border border-paper-line bg-paper-soft p-6 text-center">
      <h2 className="font-serif text-xl">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-lo">{body}</p>
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/** Neutral notice for errors and confirmations. Never brick: brick means "weak topic" only. */
export function Notice({ tone = "info", children }: { tone?: "info" | "error" | "success"; children: ReactNode }) {
  const border = tone === "success" ? "border-pine" : tone === "error" ? "border-hi" : "border-paper-line";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-[3px] border-l-4 ${border} bg-paper-soft px-4 py-3 text-sm`}>
      {children}
    </div>
  );
}
