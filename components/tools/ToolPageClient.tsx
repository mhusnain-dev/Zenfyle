"use client";

import { useCallback, useMemo, useState } from "react";
import { AlertCircle, KeyRound, ServerCog } from "lucide-react";
import type { Tool } from "@/lib/registry";
import type { ProcessOptions } from "@/lib/processors/types";
import { getProcessor } from "@/lib/processors";
import { runServerJob } from "@/lib/processors/server-job";
import type { Processor } from "@/lib/processors/types";
import { useToolJob } from "@/hooks/useToolJob";
import { UploadZone } from "@/components/tools/UploadZone";
import { FileList } from "@/components/tools/FileList";
import { OptionsPanel } from "@/components/tools/OptionsPanel";
import { ProcessingState } from "@/components/tools/ProcessingState";
import { ResultState } from "@/components/tools/ResultState";

/*
 * Shared tool page interface (Section 4.2 / 11.4) — built once, parameterized
 * from the registry, reused by every tool. Holds the selected files, the
 * options state, and the useToolJob state machine, and switches between the
 * entry, processing, result, and error screens (all six states of Section
 * 6.5). Only the processor and options component differ per tool.
 */
export function ToolPageClient({ tool }: { tool: Tool }) {
  // Server-side tools (Section 6) run through the /api/jobs pipeline, exposed
  // as a Processor so useToolJob drives both paths identically. Client-side
  // tools use their in-browser processor. The registry's `processing` field is
  // the single source of truth for which path a tool takes.
  const processor = useMemo<Processor | undefined>(() => {
    if (tool.processing === "server") {
      return (input, onProgress, signal) =>
        runServerJob(tool.slug, input, onProgress, signal);
    }
    return getProcessor(tool.slug);
  }, [tool.slug, tool.processing]);
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<ProcessOptions>({});
  const [pickError, setPickError] = useState<string | null>(null);

  const {
    state,
    progress,
    result,
    error,
    errorCode,
    needsServer,
    run,
    cancel,
    reset,
  } = useToolJob(tool.slug, processor);

  const minFiles = tool.acceptsMultipleFiles ? 2 : 1;

  const addFiles = useCallback(
    (incoming: File[]) => {
      setPickError(null);
      setOptions({}); // Section 13.6: options reset when the file set changes
      setFiles((prev) =>
        tool.acceptsMultipleFiles ? [...prev, ...incoming] : incoming.slice(0, 1),
      );
    },
    [tool.acceptsMultipleFiles],
  );

  const reorder = useCallback((from: number, to: number) => {
    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  const removeAt = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const startOver = useCallback(() => {
    setFiles([]);
    setOptions({});
    setPickError(null);
    reset();
  }, [reset]);

  // Result screen (success)
  if (state === "success" && result) {
    return <ResultState result={result} onReset={startOver} />;
  }

  // Processing / uploading / queued
  if (state === "uploading" || state === "queued" || state === "processing") {
    return (
      <ProcessingState state={state} progress={progress} onCancel={cancel} />
    );
  }

  // Error state (Section 4.2 step 5) — keeps the file loaded for "Try again".
  // needsServer is the Section 11.6 client-limit fallback, shown distinctly.
  // A wrong password (§4.1c) isn't a hard failure — it's a correctable input,
  // so it reads as guidance and keeps the password field loaded for retry.
  const wrongPassword = errorCode === "INVALID_PASSWORD";
  const errorBanner =
    state === "error" && error ? (
      <div
        className={`flex items-start gap-3 rounded-card border p-4 ${
          needsServer || wrongPassword
            ? "border-signal/40 bg-icon-bg"
            : "border-error/30 bg-[#FBEBEB]"
        }`}
        role="alert"
      >
        {wrongPassword ? (
          <KeyRound size={20} className="mt-0.5 shrink-0 text-signal" />
        ) : needsServer ? (
          <ServerCog size={20} className="mt-0.5 shrink-0 text-signal" />
        ) : (
          <AlertCircle size={20} className="mt-0.5 shrink-0 text-error" />
        )}
        <div>
          <p className="font-body text-sm font-medium text-text">
            {needsServer
              ? "This file needs server processing"
              : wrongPassword
                ? "That password didn't work"
                : "Couldn't finish"}
          </p>
          <p className="mt-0.5 font-body text-[13px] leading-[18px] text-text-secondary">
            {wrongPassword
              ? "Double-check the password and try again."
              : error}
          </p>
        </div>
      </div>
    ) : null;

  const canProcess = files.length >= minFiles && state !== "cancelled";

  return (
    <div className="space-y-6">
      <UploadZone tool={tool} onFiles={addFiles} onReject={setPickError} />

      {pickError && (
        <p className="font-body text-[13px] text-error" role="alert">
          {pickError}
        </p>
      )}

      {errorBanner}

      {files.length > 0 && (
        <>
          <div>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-display text-base font-medium text-text">
                {files.length} file{files.length === 1 ? "" : "s"} selected
              </h2>
              {tool.acceptsMultipleFiles && files.length < minFiles && (
                <span className="font-body text-[13px] text-text-secondary">
                  Add at least {minFiles} to merge
                </span>
              )}
            </div>
            <FileList
              files={files}
              reorderable={tool.acceptsMultipleFiles}
              onReorder={reorder}
              onRemove={removeAt}
            />
          </div>

          <div className="rounded-card border border-border bg-paper-alt p-4">
            <OptionsPanel
              tool={tool}
              files={files}
              value={options}
              onChange={setOptions}
            />
          </div>

          <button
            type="button"
            disabled={!canProcess}
            onClick={() => run(files, options)}
            className="w-full rounded-card bg-signal px-6 py-3.5 font-body text-base font-semibold text-white shadow-[0_4px_14px_rgba(255,107,53,0.28)] transition-all hover:bg-signal-hover hover:shadow-[0_6px_20px_rgba(255,107,53,0.36)] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            {state === "error" ? "Try again" : tool.name}
          </button>
        </>
      )}
    </div>
  );
}
