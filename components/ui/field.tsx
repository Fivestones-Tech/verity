import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "block w-full min-h-11 rounded-[3px] border border-paper-line bg-paper px-3 py-2 text-hi outline-none focus:border-pine";

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="eyebrow mb-1.5 block">
      {children}
    </label>
  );
}

export function Field({
  label,
  id,
  hint,
  error,
  ...input
}: ComponentProps<"input"> & { label: string; id: string; hint?: string; error?: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <input id={id} name={input.name ?? id} aria-invalid={error ? true : undefined} {...input} className={inputClass} />
      {hint && !error && <p className="mt-1 text-sm text-lo">{hint}</p>}
      {error && <p className="mt-1 text-sm text-hi">⚠ {error}</p>}
    </div>
  );
}

export function SelectField({
  label,
  id,
  children,
  ...rest
}: ComponentProps<"select"> & { label: string; id: string }) {
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <select id={id} name={rest.name ?? id} {...rest} className={inputClass}>
        {children}
      </select>
    </div>
  );
}
