"use client";

import { useEffect } from "react";
import type { ProcessOptions } from "@/lib/processors/types";

/*
 * Add Page Numbers options (Section 11.6): where the number sits (six
 * positions), what number to start at, and whether to show "n of N". Owns its
 * defaults (bottom-center, start at 1) and reports up via onChange.
 */
const POSITIONS: { value: string; label: string }[] = [
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
  { value: "top-left", label: "Top left" },
];

export function PageNumbersOptions({
  value,
  onChange,
}: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const position = (value.position as string) ?? "bottom-center";
  const startAt = (value.startAt as number) ?? 1;
  const showTotal = Boolean(value.showTotal ?? false);

  useEffect(() => {
    if (value.position === undefined)
      onChange({ position: "bottom-center", startAt: 1, showTotal: false });
  }, [value.position, onChange]);

  const set = (patch: ProcessOptions) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="pn-position"
          className="block font-body text-[13px] font-medium text-text"
        >
          Position
        </label>
        <select
          id="pn-position"
          value={position}
          onChange={(e) => set({ position: e.target.value })}
          className="mt-1.5 w-full rounded-card border border-border bg-white px-3 py-2 font-body text-[13px] text-text outline-none focus:border-signal"
        >
          {POSITIONS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor="pn-start"
          className="block font-body text-[13px] font-medium text-text"
        >
          Start numbering at
        </label>
        <input
          id="pn-start"
          type="number"
          min={0}
          value={startAt}
          onChange={(e) => set({ startAt: Math.max(0, Number(e.target.value) || 0) })}
          className="mt-1.5 w-24 rounded-card border border-border bg-white px-3 py-2 font-mono text-[13px] text-text outline-none focus:border-signal"
        />
      </div>

      <label className="flex cursor-pointer items-center gap-2.5">
        <input
          type="checkbox"
          checked={showTotal}
          onChange={(e) => set({ showTotal: e.target.checked })}
          className="accent-signal"
        />
        <span className="font-body text-[13px] text-text">
          Show total (e.g. &ldquo;3 of 10&rdquo;)
        </span>
      </label>
    </div>
  );
}
