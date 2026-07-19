"use client";

import { useState } from "react";
import { Check, Download, RotateCcw } from "lucide-react";
import type { OutputFile, ProcessResult } from "@/lib/processors/types";

/*
 * Result/download screen (Section 4.2 step 4). Prominent signal download
 * button as the obvious next action, a plain summary of what changed, an
 * optional secondary note (e.g. Compress "already optimally sized"), the
 * 2-hour delete notice, and a secondary "Process another file" that returns to
 * entry without a reload.
 *
 * Output count: single output → one primary button; 2-3 outputs → the primary
 * button downloads them all and each is also listed individually. >3 outputs
 * are already zipped upstream (package-outputs), so this only ever sees 1-3.
 */
export function ResultState({
  result,
  onReset,
}: {
  result: ProcessResult;
  onReset: () => void;
}) {
  const [downloaded, setDownloaded] = useState(false);
  const { outputs } = result;
  const multiple = outputs.length > 1;

  // Create a fresh object URL at click time, trigger the download, then revoke
  // it. We deliberately do NOT hold a URL across renders: React Strict Mode
  // double-invokes effects (mount → unmount → remount), so an effect-managed
  // URL gets revoked on the throwaway unmount and the download link goes dead
  // ("check your internet connection" in Chrome). Creating per-click avoids
  // that entirely and still can't leak.
  const downloadOne = (file: OutputFile) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke after the click has been dispatched; a small delay keeps Firefox
    // happy, which can cancel an in-flight download if the URL is revoked too
    // eagerly.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const downloadAll = () => {
    outputs.forEach((f) => downloadOne(f));
    setDownloaded(true);
  };

  return (
    <div className="rounded-card border border-border bg-white p-8 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E7F5EE] text-[#157A4A]">
        <Check size={28} strokeWidth={2.5} />
      </span>
      <h2 className="mt-4 font-display text-xl font-medium text-text">Done</h2>
      <p className="mt-1 font-body text-sm text-text-secondary">
        {result.summary}
      </p>
      {result.note && (
        <p className="mx-auto mt-3 max-w-sm rounded-card bg-paper-alt px-4 py-2 font-body text-[13px] leading-[18px] text-text-secondary">
          {result.note}
        </p>
      )}

      <div className="mt-6 flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={downloadAll}
          className="inline-flex items-center gap-2 rounded-card bg-signal px-6 py-3 font-body text-base font-semibold text-white shadow-[0_4px_14px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover hover:shadow-[0_6px_20px_rgba(255,107,53,0.36)]"
        >
          <Download size={18} strokeWidth={2.5} />
          {downloaded
            ? "Download again"
            : multiple
              ? `Download ${outputs.length} files`
              : "Download"}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex items-center gap-1.5 font-body text-sm font-medium text-text-secondary transition-colors hover:text-signal"
        >
          <RotateCcw size={15} strokeWidth={2} />
          Process another file
        </button>
      </div>

      {multiple && (
        <ul className="mx-auto mt-5 max-w-sm space-y-1.5 text-left">
          {outputs.map((file) => (
            <li key={file.filename}>
              <button
                type="button"
                onClick={() => downloadOne(file)}
                className="flex w-full items-center gap-2 rounded-card border border-border bg-white px-3 py-2 font-mono text-[12px] text-text transition-colors hover:border-signal/50"
              >
                <Download size={13} className="shrink-0 text-text-secondary" />
                <span className="truncate">{file.filename}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 font-body text-[12px] leading-[17px] text-text-secondary">
        Files processed on our servers are deleted automatically within 2 hours.
        This tool runs entirely in your browser — your files never left your
        device.
      </p>
    </div>
  );
}
