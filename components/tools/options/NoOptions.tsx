"use client";

/*
 * Placeholder options panel for tools that take no settings (§4.3) — e.g. the
 * straight format conversions (Word→PDF, PDF→JPG). Every tool names an
 * optionsComponent in the registry, so rather than special-casing "no options"
 * in the panel/page, these tools point here and get a short reassurance line
 * instead of an empty bordered card. Owns no state and reports nothing up.
 */
export function NoOptions() {
  return (
    <p className="font-body text-[13px] leading-5 text-text-secondary">
      No settings needed — just upload your file and go.
    </p>
  );
}
