"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ProcessOptions,
  ProcessResult,
  Processor,
} from "@/lib/processors/types";
import { ClientLimitExceeded } from "@/lib/processors/types";
import { packageOutputs } from "@/lib/processors/package-outputs";

/*
 * Shared upload → process → download state machine (Section 6.5, 11.1's
 * hooks/useToolJob). One hook drives every tool page. Client-side tools
 * (Phase 5) run the processor in-browser and never touch `uploading`/`queued`
 * — those states exist for the server path wired in Phase 6, so the same hook
 * covers both without a rewrite.
 */
export type JobState =
  | "idle"
  | "uploading"
  | "queued"
  | "processing"
  | "success"
  | "error"
  | "cancelled";

export type JobProgress = { percent: number; label: string };

export function useToolJob(slug: string, processor: Processor | undefined) {
  const [state, setState] = useState<JobState>("idle");
  const [progress, setProgress] = useState<JobProgress>({
    percent: 0,
    label: "",
  });
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True when the input exceeded the client limit (Section 11.6 server-path
  // fallback) — the UI shows a distinct message rather than a generic error.
  const [needsServer, setNeedsServer] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (files: File[], options: ProcessOptions) => {
      if (!processor) {
        setState("error");
        setError("This tool isn't available yet.");
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      setResult(null);
      setError(null);
      setNeedsServer(false);
      setProgress({ percent: 0, label: "Starting" });
      setState("processing");

      try {
        const res = await processor(
          { files, options },
          (percent, label) => setProgress({ percent, label }),
          controller.signal,
        );
        if (controller.signal.aborted) return; // cancel already set the state
        // Apply the >3-files ZIP rule centrally (Section 6) so no processor
        // re-implements packaging.
        const outputs = await packageOutputs(slug, res.outputs);
        if (controller.signal.aborted) return;
        setResult({ ...res, outputs });
        setState("success");
      } catch (err) {
        if (controller.signal.aborted || (err as Error).name === "AbortError") {
          setState("cancelled");
          return;
        }
        if (err instanceof ClientLimitExceeded) setNeedsServer(true);
        setError(
          err instanceof Error ? err.message : "Something went wrong.",
        );
        setState("error");
      } finally {
        abortRef.current = null;
      }
    },
    [slug, processor],
  );

  // Cancel an in-flight run (Section 11.10 upload/processing cancellation).
  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState("cancelled");
  }, []);

  // Return to entry state (Result screen's "Process another file" / Try again).
  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState("idle");
    setProgress({ percent: 0, label: "" });
    setResult(null);
    setError(null);
    setNeedsServer(false);
  }, []);

  return { state, progress, result, error, needsServer, run, cancel, reset };
}
