"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import type { ProcessOptions } from "@/lib/processors/types";

/*
 * Rotate PDF options (Section 11.6): 90° increments only via a simple 4-way
 * control (90/180/270), applied to all pages. No free-angle rotation for MVP.
 * Default 90°.
 */
const CHOICES = [90, 180, 270] as const;

export function RotateOptions({
  value,
  onChange,
}: {
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const selected = Number(value.degrees ?? 90);

  useEffect(() => {
    if (value.degrees === undefined) onChange({ degrees: 90 });
  }, [value.degrees, onChange]);

  return (
    <div className="space-y-3">
      <p className="font-body text-[13px] font-medium text-text">Rotate all pages by</p>
      <div className="flex gap-2">
        {CHOICES.map((deg) => (
          <button
            key={deg}
            type="button"
            onClick={() => onChange({ degrees: deg })}
            aria-pressed={selected === deg}
            className={`flex flex-1 flex-col items-center gap-1 rounded-card border px-3 py-3 font-body text-[13px] font-medium transition-colors ${
              selected === deg
                ? "border-signal bg-icon-bg text-signal"
                : "border-border bg-white text-text hover:border-signal/50"
            }`}
          >
            <RotateCw
              size={18}
              style={{ transform: `rotate(${deg}deg)` }}
              aria-hidden
            />
            {deg}°
          </button>
        ))}
      </div>
    </div>
  );
}
