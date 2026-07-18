"use client";

import { useEffect, useState } from "react";
import { Check, Download, RotateCcw } from "lucide-react";
import type { ProcessResult } from "@/lib/processors/types";

/*
 * Result/download screen (Section 4.2 step 4). Prominent signal download
 * button as the obvious next action, a plain summary of what changed, the
 * 2-hour delete notice, and a secondary "Process another file" that returns to
 * entry without a reload. A quick, skippable check animation — never blocks
 * the download button.
 */
export function ResultState({
  result,
  onReset,
}: {
  result: ProcessResult;
  onReset: () => void;
}) {
  // Create the object URL once (lazy init) and revoke it on unmount to avoid a
  // leak. ResultState is remounted per result (startOver unmounts it), so the
  // blob never changes under a mounted instance.
  const [url] = useState(() => URL.createObjectURL(result.blob));
  useEffect(() => () => URL.revokeObjectURL(url), [url]);

  const [downloaded, setDownloaded] = useState(false);

  return (
    <div className="rounded-card border border-border bg-white p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F5EE] text-[#157A4A]">
        <Check size={28} strokeWidth={2.5} />
      </span>
      <h2 className="mt-4 font-display text-xl font-medium text-text">
        Done
      </h2>
      <p className="mt-1 font-body text-sm text-text-secondary">
        {result.summary}
      </p>

      <div className="mt-6 flex flex-col items-center gap-3">
        <a
          href={url}
          download={result.filename}
          onClick={() => setDownloaded(true)}
          className="inline-flex items-center gap-2 rounded-card bg-signal px-6 py-3 font-body text-base font-semibold text-white shadow-[0_4px_14px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover hover:shadow-[0_6px_20px_rgba(255,107,53,0.36)]"
        >
          <Download size={18} strokeWidth={2.5} />
          {downloaded ? "Download again" : "Download"}
        </a>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-text-secondary transition-colors hover:text-signal"
        >
          <RotateCcw size={15} strokeWidth={2} />
          Process another file
        </button>
      </div>

      <p className="mt-6 font-body text-[12px] leading-[17px] text-text-secondary">
        Files processed on our servers are deleted automatically within 2 hours.
        This tool runs entirely in your browser — your files never left your
        device.
      </p>
    </div>
  );
}
