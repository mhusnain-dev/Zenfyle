"use client";

/*
 * Merge PDF options (Section 11.6). Merge's only real "option" is the output
 * order of the files, which is handled directly by the reorderable FileList on
 * the tool page — so there's no extra control to render here. This component
 * exists so Merge still resolves through the OptionsPanel lookup (Section 4.3)
 * like every other tool, and gives a home for any future merge option (e.g. a
 * bookmark/outline toggle) without special-casing the panel.
 */
export function MergeOptions() {
  return (
    <p className="font-body text-[13px] leading-[18px] text-text-secondary">
      Files merge top to bottom. Drag to reorder them before merging.
    </p>
  );
}
