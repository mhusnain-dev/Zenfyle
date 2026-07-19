"use client";

import { useEffect } from "react";
import type { ProcessOptions } from "@/lib/processors/types";

/*
 * Add Watermark options (Section 11.6): the text, layout (diagonal stamp or
 * horizontal label), and opacity. Owns its defaults (diagonal, 30%) and reports
 * up via onChange.
 */
export function WatermarkOptions({
  value,
  onChange,
}: {
  files: File[];
  value: ProcessOptions;
  onChange: (value: ProcessOptions) => void;
}) {
  const text = (value.text as string) ?? "";
  const layout = (value.layout as string) ?? "diagonal";
  const opacity = (value.opacity as number) ?? 0.3;

  useEffect(() => {
    if (value.layout === undefined)
      onChange({ text: "", layout: "diagonal", opacity: 0.3 });
  }, [value.layout, onChange]);

  const set = (patch: ProcessOptions) => onChange({ ...value, ...patch });

  return (
    <div className="space-y-3">
      <div>
        <label
          htmlFor="wm-text"
          className="block font-body text-[13px] font-medium text-text"
        >
          Watermark text
        </label>
        <input
          id="wm-text"
          type="text"
          value={text}
          onChange={(e) => set({ text: e.target.value })}
          placeholder="e.g. CONFIDENTIAL"
          maxLength={40}
          className="mt-1.5 w-full rounded-card border border-border bg-white px-3 py-2 font-body text-[13px] text-text outline-none focus:border-signal"
        />
      </div>

      <div>
        <span className="block font-body text-[13px] font-medium text-text">
          Layout
        </span>
        <div className="mt-1.5 flex gap-4">
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="wm-layout"
              checked={layout === "diagonal"}
              onChange={() => set({ layout: "diagonal" })}
              className="accent-signal"
            />
            <span className="font-body text-[13px] text-text">Diagonal</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2">
            <input
              type="radio"
              name="wm-layout"
              checked={layout === "horizontal"}
              onChange={() => set({ layout: "horizontal" })}
              className="accent-signal"
            />
            <span className="font-body text-[13px] text-text">Horizontal</span>
          </label>
        </div>
      </div>

      <div>
        <label
          htmlFor="wm-opacity"
          className="block font-body text-[13px] font-medium text-text"
        >
          Opacity: {Math.round(opacity * 100)}%
        </label>
        <input
          id="wm-opacity"
          type="range"
          min={5}
          max={100}
          value={Math.round(opacity * 100)}
          onChange={(e) => set({ opacity: Number(e.target.value) / 100 })}
          className="mt-1.5 w-full accent-signal"
        />
      </div>
    </div>
  );
}
