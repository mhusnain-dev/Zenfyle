"use client";

import type { ProcessOptions } from "@/lib/processors/types";
import { usePageCount } from "@/hooks/usePageCount";

/*
 * Remove Pages options (Section 11.6): a simple 1-based page list to delete
 * (e.g. 2,5,9). Validation and range checks live in the processor's shared
 * parser (page-range) so the message shown is the same one the processor
 * would raise.
 */
export function RemovePagesOptions({
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
        htmlFor="remove-pages"
        className="block font-body text-[13px] font-medium text-text"
      >
        Pages to remove
      </label>
      <input
        id="remove-pages"
        type="text"
        inputMode="numeric"
        value={pages}
        onChange={(e) => onChange({ pages: e.target.value })}
        placeholder="e.g. 2, 5, 9"
        className="w-full rounded-card border border-border bg-white px-3 py-2 font-mono text-[13px] text-text outline-none focus:border-signal"
      />
      <p className="font-body text-[12px] text-text-secondary">
        Separate pages with commas, or use ranges like 4-6
        {pageCount ? `. This PDF has ${pageCount} pages.` : "."}
      </p>
    </div>
  );
}
