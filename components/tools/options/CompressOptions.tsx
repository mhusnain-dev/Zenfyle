"use client";

import { useEffect } from "react";
import type { ProcessOptions } from "@/lib/processors/types";

/*
 * Compress Image options (Section 11.6): three presets — Low / Medium / High
 * compression, no manual quality slider for MVP. "Compression" here means how
 * hard we squeeze: Low keeps the most quality, High makes the smallest file.
 * Default Medium.
 */
const PRESETS = [
  { id: "low", label: "Low", hint: "Best quality" },
  { id: "medium", label: "Medium", hint: "Balanced" },
  { id: "high", label: "High", hint: "Smallest file" },
] as const;

export function CompressOptions({
  value,
  onChange,
}: {
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const preset = (value.preset as string) ?? "medium";

  useEffect(() => {
    if (value.preset === undefined) onChange({ preset: "medium" });
  }, [value.preset, onChange]);

  return (
    <div className="space-y-3">
      <p className="font-body text-[13px] font-medium text-text">Compression level</p>
      <div className="flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ preset: p.id })}
            aria-pressed={preset === p.id}
            className={`flex flex-1 flex-col items-center gap-0.5 rounded-card border px-3 py-3 transition-colors ${
              preset === p.id
                ? "border-signal bg-icon-bg"
                : "border-border bg-white hover:border-signal/50"
            }`}
          >
            <span
              className={`font-body text-[13px] font-medium ${preset === p.id ? "text-signal" : "text-text"}`}
            >
              {p.label}
            </span>
            <span className="font-body text-[11px] text-text-secondary">{p.hint}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
