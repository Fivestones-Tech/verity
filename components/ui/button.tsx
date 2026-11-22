import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

type Variant = "primary" | "ghost" | "gold";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 font-mono text-[0.78rem] font-medium uppercase tracking-[0.06em] transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const variants: Record<Variant, string> = {
  primary: "bg-pine text-ink-hi hover:bg-pine-deep",
  ghost: "border border-paper-line bg-transparent text-hi hover:bg-paper-soft",
  gold: "bg-gold text-hi hover:bg-gold-soft",
};

export function buttonClass(variant: Variant = "primary", extra = "") {
  return `${base} ${variants[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return <button {...props} className={buttonClass(variant, className)} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  className = "",
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}
