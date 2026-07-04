import type { ReactNode } from "react";

/** Labelled field wrapper with optional hint + validation message. */
export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-sm font-medium text-ink"
      >
        {label}
      </label>
      {hint ? <p className="mb-2 text-xs text-ink-soft">{hint}</p> : null}
      {children}
      {error ? (
        <p role="alert" className="mt-1 text-xs text-accent-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const inputBase =
  "w-full min-h-[44px] rounded-xl border border-line bg-paper-raised px-3 py-2 text-sm text-ink placeholder:text-ink-faint outline-none transition-colors duration-200 ease-calm focus:border-accent focus:ring-2 focus:ring-accent-soft";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>
) {
  return <input {...props} className={`${inputBase} ${props.className ?? ""}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>
) {
  return (
    <textarea
      rows={3}
      {...props}
      className={`${inputBase} resize-none ${props.className ?? ""}`}
    />
  );
}

/** A calm on/off switch (checkbox under the hood). */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  id?: string;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <label htmlFor={id} className="block text-sm font-medium text-ink">
          {label}
        </label>
        {hint ? <p className="mt-0.5 text-xs text-ink-soft">{hint}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={[
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-calm",
          checked ? "bg-accent" : "bg-line-strong",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-200 ease-calm",
            checked ? "translate-x-5" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export interface SegOption<T extends string> {
  value: T;
  label: string;
}

/** Segmented single-choice control (used for tier / action type / schedule). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: SegOption<T>[];
  onChange: (next: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={[
              "min-h-[44px] flex-1 rounded-xl border px-3 py-2 text-sm font-medium transition-colors duration-200 ease-calm",
              active
                ? "border-accent bg-accent-soft text-accent-ink"
                : "border-line bg-paper-raised text-ink-soft hover:border-line-strong",
            ].join(" ")}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
