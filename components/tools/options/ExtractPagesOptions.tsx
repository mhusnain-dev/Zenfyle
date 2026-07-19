"use client";

import type { ProcessOptions } from "@/lib/processors/types";
import { usePageCount } from "@/hooks/usePageCount";

/*
 * Extract Pages options (Section 11.6): a 1-based page list to pull into a new
 * PDF (e.g. 1, 3, 5-7). Mirrors Remove Pages' single-field shape; validation
 * and range checks live in the shared page-range parser so the message shown is
 * the same one the processor would raise.
 */
export function ExtractPagesOptions({
  files,
  value,
  onChange,
}: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const pageCount = usePageCount(files[0]);
  const pages = (value.pages as string) ?? "";

  return (
    <div className="space-y-2">
      <label
        htmlFor="extract-pages"
        className="block font-body text-[13px] font-medium text-text"
      >
        Pages to extract
      </label>
      <input
        id="extract-pages"
        type="text"
        inputMode="numeric"
        value={pages}
        onChange={(e) => onChange({ pages: e.target.value })}
        placeholder="e.g. 1, 3, 5-7"
        className="w-full rounded-card border border-border bg-white px-3 py-2 font-mono text-[13px] text-text outline-none focus:border-signal"
      />
      <p className="font-body text-[12px] text-text-secondary">
        Separate pages with commas, or use ranges like 5-7
        {pageCount ? `. This PDF has ${pageCount} pages.` : "."}
      </p>
    </div>
  );
}
