"use client";

import type { JobProgress, JobState } from "@/hooks/useToolJob";

/*
 * Processing screen (Section 4.2 step 3 / 6.5). Honest status text from the
 * processor's progress reporter, a determinate bar, and a Cancel action that
 * aborts and returns to entry (Section 11.10). Covers uploading/queued too so
 * the same component serves the Phase 6 server path.
 */
const STATE_FALLBACK: Record<string, string> = {
  uploading: "Uploading",
  queued: "Waiting in queue",
  processing: "Processing",
};

export function ProcessingState({
  state,
  progress,
  onCancel,
}: {
  state: JobState;
  progress: JobProgress;
  onCancel: () => void;
}) {
  const label = progress.label || STATE_FALLBACK[state] || "Working";
  const percent = Math.max(0, Math.min(100, progress.percent));

  return (
    <div className="rounded-card border border-border bg-white p-8">
      <div className="flex items-center justify-between">
        <p className="font-display text-lg font-medium text-text">{label}…</p>
        <span className="font-mono text-sm text-text-secondary">
          {percent}%
        </span>
      </div>
      <div
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-border"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div
          className="h-full rounded-full bg-signal transition-[width] duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
      <button
        type="button"
        onClick={onCancel}
        className="mt-6 rounded-card border border-border bg-white px-4 py-2 font-body text-sm font-medium text-text transition-colors hover:border-signal"
      >
        Cancel
      </button>
    </div>
  );
}
