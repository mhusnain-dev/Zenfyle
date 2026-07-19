import type { ProcessInput, ProcessResult, ProgressReporter } from "./types";

/*
 * Server-side job client (Section 6.2). The browser counterpart to the
 * /api/jobs Route Handlers: uploads the file, polls status every 2s, and on
 * success downloads the output blob — then returns the SAME ProcessResult shape
 * a client-side processor returns, so ResultState/useToolJob don't care which
 * path produced the file. This is what makes one tool page cover both paths.
 */

const POLL_INTERVAL_MS = 2000;

type JobStatus =
  | "queued"
  | "processing"
  | "success"
  | "error"
  | "cancelled"
  | "expired";

type StatusResponse = {
  status: JobStatus;
  progress?: { stage: string; percent: number; message?: string };
  download_url?: string;
  error_message?: string;
  error_code?: string;
  note?: string;
};

/** Human labels for the coarse stages the poller reports (Section 4.2 step 3). */
const STAGE_LABELS: Record<string, string> = {
  queued: "Waiting in queue",
  starting: "Starting",
  processing: "Processing",
  compressing: "Compressing",
  converting: "Converting",
  finalizing: "Finalizing",
};

function labelFor(stage: string, message?: string): string {
  return message ?? STAGE_LABELS[stage] ?? "Processing";
}

/**
 * Runs a server-side tool job to completion. `slug` picks the tool; `input`
 * carries the file(s) and options. Rejects on error/cancel/timeout with a
 * message safe to show the user (the API already sanitizes these).
 */
export async function runServerJob(
  slug: string,
  input: ProcessInput,
  onProgress: ProgressReporter,
  signal: AbortSignal,
): Promise<ProcessResult> {
  if (input.files.length === 0) {
    throw new Error("No file selected.");
  }

  onProgress(0, "Uploading");

  // 1. Upload → create the job. Section 6.2 accepts a single file per job.
  const form = new FormData();
  form.append("tool_slug", slug);
  form.append("file", input.files[0]);
  if (Object.keys(input.options).length > 0) {
    form.append("options", JSON.stringify(input.options));
  }

  const createRes = await fetch("/api/jobs", {
    method: "POST",
    body: form,
    signal,
  });
  const createData = await createRes.json().catch(() => null);
  if (!createRes.ok) {
    throw new Error(
      createData?.error?.message ?? "Could not start processing this file.",
    );
  }
  const jobId: string = createData.job_id;

  onProgress(2, "Waiting in queue");

  // 2. Poll status every 2s until a terminal state (Section 6.2).
  for (;;) {
    if (signal.aborted) {
      // Best-effort server-side cancel so the worker stops too (Section 11.10).
      void fetch(`/api/jobs/${jobId}`, { method: "DELETE" }).catch(() => {});
      const err = new Error("Cancelled");
      err.name = "AbortError";
      throw err;
    }

    await delay(POLL_INTERVAL_MS, signal);

    const statusRes = await fetch(`/api/jobs/${jobId}`, { signal });
    const data = (await statusRes.json().catch(() => null)) as
      | StatusResponse
      | { error: { message: string } }
      | null;

    if (!statusRes.ok || !data || "error" in data) {
      const msg =
        data && "error" in data
          ? data.error.message
          : "Lost contact with the server.";
      throw new Error(msg);
    }

    switch (data.status) {
      case "queued":
        onProgress(Math.max(2, data.progress?.percent ?? 0), "Waiting in queue");
        break;
      case "processing":
        onProgress(
          data.progress?.percent ?? 10,
          labelFor(data.progress?.stage ?? "processing", data.progress?.message),
        );
        break;
      case "success": {
        onProgress(100, "Done");
        return await downloadResult(data, slug);
      }
      case "error": {
        const err = new Error(
          data.error_message ?? "Something went wrong processing this file.",
        );
        // Attach the Section 13.7 code so callers can branch (e.g. re-prompt
        // for a password on INVALID_PASSWORD). Ready for the §251 inline
        // re-prompt loop; today the message alone drives the error screen.
        if (data.error_code) (err as { code?: string }).code = data.error_code;
        throw err;
      }
      case "cancelled": {
        const err = new Error("Cancelled");
        err.name = "AbortError";
        throw err;
      }
      case "expired":
        throw new Error("This job expired before it could finish.");
    }
  }
}

async function downloadResult(
  data: StatusResponse,
  slug: string,
): Promise<ProcessResult> {
  if (!data.download_url) {
    throw new Error("The processed file wasn't available to download.");
  }
  const fileRes = await fetch(data.download_url);
  if (!fileRes.ok) {
    throw new Error("The processed file wasn't available to download.");
  }
  const blob = await fileRes.blob();
  const filename = filenameFromResponse(fileRes) ?? `zenfyle-${slug}`;

  return {
    outputs: [{ blob, filename }],
    summary: "Your file is ready to download.",
    note: data.note,
  };
}

/** Pull the server-provided filename out of Content-Disposition if present. */
function filenameFromResponse(res: Response): string | null {
  const cd = res.headers.get("content-disposition");
  const match = cd?.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? null;
}

/** A cancellable delay — rejects with AbortError if the signal fires. */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      const err = new Error("Cancelled");
      err.name = "AbortError";
      reject(err);
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      const err = new Error("Cancelled");
      err.name = "AbortError";
      reject(err);
    }
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
