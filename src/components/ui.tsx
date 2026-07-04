import type { ButtonHTMLAttributes, ReactNode } from "react";

/** Page heading block used at the top of each screen. */
export function ScreenHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mb-5 animate-gentle-fade">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      {subtitle ? (
        <p className="mt-1 text-sm text-ink-soft">{subtitle}</p>
      ) : null}
    </header>
  );
}

/** Soft raised surface. */
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-paper-raised p-4 ${className}`}
    >
      {children}
    </div>
  );
}

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-deep active:bg-accent-deep border border-transparent",
  secondary:
    "bg-paper-sunken text-ink hover:bg-line border border-line",
  ghost: "bg-transparent text-accent-deep hover:bg-accent-soft border border-transparent",
};

export function Button({
  variant = "primary",
  className = "",
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={[
        "inline-flex min-h-[44px] items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ease-calm disabled:opacity-50 disabled:pointer-events-none",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A gentle empty-state block. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-line bg-paper-raised/60 px-5 py-10 text-center animate-gentle-fade">
      <p className="text-base font-medium text-ink">{title}</p>
      {body ? <p className="mx-auto mt-2 max-w-xs text-sm text-ink-soft">{body}</p> : null}
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}
