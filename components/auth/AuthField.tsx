import type { InputHTMLAttributes } from "react";

/*
 * Shared labeled input for the auth forms (Section 3.6 accessibility: every
 * field has an associated <label>, focus ring uses the signal token, an optional
 * hint is wired to the input via aria-describedby). The parent form owns the
 * value; `id` doubles as the field `name` unless one is passed explicitly.
 */
export function AuthField({
  id,
  label,
  hint,
  name,
  ...props
}: {
  id: string;
  label: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block font-body text-[13px] font-medium text-text"
      >
        {label}
      </label>
      <input
        id={id}
        name={name ?? id}
        aria-describedby={hintId}
        className="w-full rounded-card border border-border bg-white px-3 py-2.5 font-body text-sm text-text outline-none transition-colors focus:border-signal"
        {...props}
      />
      {hint && (
        <p id={hintId} className="font-body text-[12px] text-text-secondary">
          {hint}
        </p>
      )}
    </div>
  );
}
