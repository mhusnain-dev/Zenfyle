"use client";

import { useEffect } from "react";
import type { ProcessOptions } from "@/lib/processors/types";
import { usePageCount } from "@/hooks/usePageCount";

/*
 * Split PDF options (Section 11.6): choose "every page into its own file" or
 * "split at specific page numbers" with a simple text input (e.g. 3,7,10).
 * Owns its defaults (mode: "each") and reports up via onChange. The tool page
 * remounts the panel per file, so defaults reset on each new file (13.6).
 */
export function SplitOptions({
  files,
  value,
  onChange,
}: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const pageCount = usePageCount(files[0]);
  const mode = (value.mode as string) ?? "each";
  const pages = (value.pages as string) ?? "";

  // Seed defaults once so the processor always sees a mode.
  useEffect(() => {
    if (value.mode === undefined) onChange({ mode: "each", pages: "" });
  }, [value.mode, onChange]);

  const set = (patch: ProcessOptions) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <p className="font-body text-[13px] font-medium text-text">How should we split it?</p>

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="radio"
          name="split-mode"
          checked={mode === "each"}
          onChange={() => set({ mode: "each" })}
          className="mt-0.5 accent-signal"
        />
        <span className="font-body text-[13px] text-text">
          Every page into its own file
          {pageCount ? (
            <span className="text-text-secondary"> ({pageCount} files)</span>
          ) : null}
        </span>
      </label>

      <label className="flex cursor-pointer items-start gap-2.5">
        <input
          type="radio"
          name="split-mode"
          checked={mode === "at"}
          onChange={() => set({ mode: "at" })}
          className="mt-0.5 accent-signal"
        />
        <span className="font-body text-[13px] text-text">Split at specific pages</span>
      </label>

      {mode === "at" && (
        <div className="pl-6">
          <input
            type="text"
            inputMode="numeric"
            value={pages}
            onChange={(e) => set({ pages: e.target.value })}
            placeholder="e.g. 3, 7, 10"
            aria-label="Pages to split at"
            className="w-full rounded-card border border-border bg-white px-3 py-2 font-mono text-[13px] text-text outline-none focus:border-signal"
          />
          <p className="mt-1.5 font-body text-[12px] text-text-secondary">
            A new file starts at each page you list
            {pageCount ? ` (1–${pageCount})` : ""}.
          </p>
        </div>
      )}
    </div>
  );
}
