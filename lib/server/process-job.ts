import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import { prisma } from "@/lib/db";
import { getStorage, storageKeys } from "@/lib/storage";
import { getServerProcessor } from "@/lib/server/tools";
import { ProcessingError, type ServerOutputFile } from "@/lib/server/tools/types";
import type { ErrorCode } from "@/lib/server/api-error";

/*
 * Worker pipeline (Section 6): the single function every job runs through,
 * regardless of tool. Flow per spec:
 *   load input from storage → run the tool adapter → package outputs (>3 → ZIP)
 *   → write outputs to storage → mint signed URL → mark success → schedule the
 *   2-hour cleanup. On any failure the job goes to `error` with a user-facing
 *   message (1-retry is handled by the queue adapter, Section 11.10).
 *
 * It writes progress to the job row as it goes so the stateless GET /api/jobs/:id
 * poll can report live status (Section 6.2).
 */

const RESULT_TTL_SECONDS = 2 * 60 * 60; // 2h, matches the cleanup delay (Section 6)

export type ProcessJobResult =
  | { status: "success" }
  | { status: "error"; message: string }
  | { status: "cancelled" };

async function setProgress(jobId: string, stage: string, percent: number) {
  await prisma.job.update({
    where: { id: jobId },
    data: { progressStage: stage, progressPercent: Math.round(percent) },
  });
}

/** Short id for output naming — derived from the job id's tail (stable, unguessable). */
function shortIdFor(jobId: string): string {
  return jobId.slice(-6);
}

export async function processJob(
  jobId: string,
  signal: AbortSignal,
): Promise<ProcessJobResult> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return { status: "error", message: "Job not found." };

  // A job already cancelled before the worker picked it up: don't process.
  if (job.status === "cancelled") return { status: "cancelled" };

  const processor = getServerProcessor(job.toolSlug);
  if (!processor) {
    const message = "This tool isn't available yet.";
    await markError(jobId, message);
    return { status: "error", message };
  }

  const storage = getStorage();
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), `zenfyle-${jobId}-`));

  try {
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "processing", startedAt: new Date(), progressPercent: 0 },
    });

    // 1. Load the validated input from storage onto local disk for the adapter.
    if (!job.inputFileRef) throw new ProcessingError("Missing input file.");
    const inputBuffer = await storage.get(job.inputFileRef);
    const inputPath = path.join(workDir, path.basename(job.inputFileRef));
    await fs.writeFile(inputPath, inputBuffer);
    await setProgress(jobId, "starting", 5);

    // 2. Run the tool adapter with the options captured at request time.
    let options: Record<string, unknown> = {};
    if (job.optionsJson) {
      try {
        options = JSON.parse(job.optionsJson) as Record<string, unknown>;
      } catch {
        options = {};
      }
    }

    // Pull the out-of-band secret (e.g. a PDF password) if one was stored, then
    // delete it immediately so it lives no longer than this run (v1.4.1). It is
    // never in optionsJson/the DB; the adapter receives it via `secret` and must
    // forward it to any child process over stdin, never argv.
    const secret = await readAndDeleteSecret(jobId);

    const result = await processor(
      {
        inputPath,
        originalFilename: job.originalFilename,
        options,
        secret,
        shortId: shortIdFor(jobId),
        workDir,
      },
      (stage, percent) => setProgress(jobId, stage, percent),
      signal,
    );

    if (signal.aborted) return { status: "cancelled" };

    // 3. Apply the >3-outputs ZIP rule centrally (Section 6), then persist to
    //    storage. Outputs 1–3 are stored individually; >3 collapse to one .zip.
    const stored = await packageAndStore(jobId, job.toolSlug, result.outputs);
    await setProgress(jobId, "finishing", 100);

    // 4. Mark success with output metadata + expiry (drives the download route
    //    and the dashboard). The signed URL is derived from outputFileRef by the
    //    download route, so we only persist the key here.
    await prisma.job.update({
      where: { id: jobId },
      data: {
        status: "success",
        outputFileRef: stored.key,
        outputFileSizeBytes: stored.sizeBytes,
        outputFileCount: result.outputs.length,
        errorMessage: result.note ?? null, // note reuses the message channel for the "already optimal" case
        errorCode: null, // clear any code from a prior failed attempt (BullMQ retry)
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + RESULT_TTL_SECONDS * 1000),
      },
    });

    return { status: "success" };
  } catch (err) {
    if (signal.aborted) {
      await prisma.job
        .update({ where: { id: jobId }, data: { status: "cancelled" } })
        .catch(() => {});
      return { status: "cancelled" };
    }
    const message =
      err instanceof ProcessingError
        ? err.userMessage
        : "Something went wrong processing this file. Please try again.";
    const code =
      err instanceof ProcessingError ? err.code : undefined;
    await markError(jobId, message, code);
    return { status: "error", message };
  } finally {
    // Always clean the local scratch dir; storage is the durable copy.
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function markError(jobId: string, message: string, code?: ErrorCode) {
  await prisma.job
    .update({
      where: { id: jobId },
      data: {
        status: "error",
        errorMessage: message,
        errorCode: code ?? null,
        completedAt: new Date(),
      },
    })
    .catch(() => {});
}

/*
 * Read the per-job secret from storage (if any) and delete it immediately so it
 * exists only for this run. Returns undefined when no secret was stored. The
 * delete is best-effort but cleanupJob sweeps the same key as a backstop.
 */
async function readAndDeleteSecret(jobId: string): Promise<string | undefined> {
  const storage = getStorage();
  const key = storageKeys.secret(jobId);
  try {
    const buf = await storage.get(key);
    return buf.toString("utf8");
  } catch {
    return undefined; // no secret for this job (the common case)
  } finally {
    await storage.delete(key).catch(() => {});
  }
}

/*
 * Store the adapter's outputs and return the single storage key the download
 * route will serve. 1–3 files that are actually one file store directly; >3 (or
 * any multi-file result) collapse into one ZIP so the UI keeps a single button.
 */
async function packageAndStore(
  jobId: string,
  slug: string,
  outputs: ServerOutputFile[],
): Promise<{ key: string; sizeBytes: number }> {
  const storage = getStorage();

  if (outputs.length === 1) {
    const buf = await fs.readFile(outputs[0].path);
    const key = storageKeys.output(jobId, outputs[0].filename);
    await storage.save(buf, key);
    return { key, sizeBytes: buf.byteLength };
  }

  // Multi-output: the server serves one signed key per job, so anything with
  // more than one output is bundled into a single ZIP (one download button,
  // Section 4.2 step 4). This is slightly stricter than the client rule (which
  // keeps 2–3 as separate links, ZIPs only >3) — a deliberate simplification
  // for the single-key download route. Currently unexercised: the only server
  // tool so far (compress-pdf) is single-output. Revisit when a multi-output
  // server tool (e.g. server-side Split) lands.
  return zipAndStore(jobId, slug, outputs);
}

async function zipAndStore(
  jobId: string,
  slug: string,
  outputs: ServerOutputFile[],
): Promise<{ key: string; sizeBytes: number }> {
  const zip = new JSZip();
  for (const out of outputs) {
    zip.file(out.filename, await fs.readFile(out.path));
  }
  const buf = await zip.generateAsync({ type: "nodebuffer" });
  const zipName = `zenfyle-${slug}-${shortIdFor(jobId)}.zip`;
  const key = storageKeys.output(jobId, zipName);
  await getStorage().save(buf, key);
  return { key, sizeBytes: buf.byteLength };
}
