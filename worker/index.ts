import "dotenv/config";
import { Worker } from "bullmq";
import IORedis from "ioredis";
import { processJob } from "@/lib/server/process-job";
import { cleanupJob } from "@/lib/server/cleanup";
import {
  PROCESS_QUEUE,
  CLEANUP_QUEUE,
  cancelFlagKey,
} from "@/lib/queue/bullmq";

/*
 * Production worker process (Section 6/295: "a separate worker process for heavy
 * conversions ... connected via the BullMQ queue"). Run alongside the Next.js
 * app: `npm run worker`. Only used when REDIS_URL is set — local dev runs jobs
 * in-process instead (lib/queue/in-process.ts), so this file is the prod path.
 *
 * - Concurrency 2 keeps memory bounded for LibreOffice/Ghostscript.
 * - stalledInterval + maxStalledCount give the spec's stall detection: a job
 *   whose worker died is re-queued.
 * - Cancellation: we poll the Redis cancel flag and abort the job's signal
 *   (BullMQ has no built-in interrupt for an in-flight job).
 */
const redisUrl = process.env.REDIS_URL?.trim();
if (!redisUrl) {
  console.error(
    "[worker] REDIS_URL is not set. The worker is only needed for the BullMQ " +
      "production path; local dev runs jobs in-process via the Next.js server.",
  );
  process.exit(1);
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

const processWorker = new Worker(
  PROCESS_QUEUE,
  async (job) => {
    const jobId = job.data.jobId as string;
    const controller = new AbortController();

    // Poll the cancel flag every second; abort the job if it's set (Section 11.10).
    const poll = setInterval(async () => {
      const flagged = await connection.get(cancelFlagKey(jobId));
      if (flagged) controller.abort();
    }, 1000);

    try {
      const result = await processJob(jobId, controller.signal);
      if (result.status === "error") {
        // Throw so BullMQ records the attempt and retries once (attempts: 2).
        throw new Error(result.message);
      }
    } finally {
      clearInterval(poll);
    }
  },
  {
    connection,
    concurrency: 2,
    stalledInterval: 30_000,
    maxStalledCount: 1, // re-run a stalled job once, then fail
  },
);

const cleanupWorker = new Worker(
  CLEANUP_QUEUE,
  async (job) => {
    await cleanupJob(job.data.jobId as string);
  },
  { connection, concurrency: 4 },
);

processWorker.on("failed", (job, err) => {
  console.error(`[worker] job ${job?.id} failed:`, err.message);
});
cleanupWorker.on("failed", (job, err) => {
  console.error(`[worker] cleanup ${job?.id} failed:`, err.message);
});

console.log("[worker] listening on", PROCESS_QUEUE, "and", CLEANUP_QUEUE);

async function shutdown() {
  console.log("[worker] shutting down");
  await Promise.all([processWorker.close(), cleanupWorker.close()]);
  await connection.quit();
  process.exit(0);
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
