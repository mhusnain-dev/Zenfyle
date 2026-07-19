import { Queue } from "bullmq";
import IORedis, { type Redis } from "ioredis";
import type { JobQueue } from "./types";
import { prisma } from "@/lib/db";

/*
 * BullMQ production queue (Section 6). Jobs are pushed to Redis and consumed by
 * the separate worker process (worker/index.ts) — the "separate worker process
 * for heavy conversions" the spec calls for. This adapter is the producer side
 * (used by the Route Handlers); the worker is the consumer.
 *
 * - Retries: jobs are enqueued with 1 automatic retry (attempts: 2) per the
 *   spec's "one retry then fail" rule (Section 11.10). Stall detection is a
 *   Worker-side setting (worker/index.ts) — a job whose worker died is re-run.
 * - Cleanup: scheduled as a delayed job on a dedicated queue so it survives
 *   process restarts (unlike the dev queue's in-memory timer).
 * - Cancel: BullMQ can't interrupt a running child process cleanly, so we set a
 *   Redis cancel flag the worker's tool loop checks between stages and honors as
 *   an AbortSignal; queued jobs are removed outright.
 */
export const PROCESS_QUEUE = "zenfyle-process";
export const CLEANUP_QUEUE = "zenfyle-cleanup";
export const cancelFlagKey = (jobId: string) => `zenfyle:cancel:${jobId}`;

class BullMQQueue implements JobQueue {
  private readonly connection: Redis;
  private readonly processQueue: Queue;
  private readonly cleanupQueue: Queue;

  constructor(redisUrl: string) {
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.processQueue = new Queue(PROCESS_QUEUE, { connection: this.connection });
    this.cleanupQueue = new Queue(CLEANUP_QUEUE, { connection: this.connection });
  }

  async enqueue(jobId: string): Promise<void> {
    await this.processQueue.add(
      "process",
      { jobId },
      {
        jobId, // dedupe: one BullMQ job per db job id
        attempts: 2, // original + 1 retry (Section 11.10)
        backoff: { type: "fixed", delay: 2000 },
        removeOnComplete: true,
        removeOnFail: 100,
      },
    );
  }

  async scheduleCleanup(jobId: string, delayMs: number): Promise<void> {
    await this.cleanupQueue.add(
      "cleanup",
      { jobId },
      { jobId: `cleanup:${jobId}`, delay: delayMs, removeOnComplete: true },
    );
  }

  async cancel(jobId: string): Promise<boolean> {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (!job || (job.status !== "queued" && job.status !== "processing")) {
      return false;
    }

    // Remove it if still waiting; if active, set a cancel flag the worker checks.
    const queued = await this.processQueue.getJob(jobId);
    if (queued) {
      const state = await queued.getState();
      if (state === "waiting" || state === "delayed") {
        await queued.remove();
      }
    }
    // Flag lives for 1h — long enough for any in-flight job to observe it.
    await this.connection.set(cancelFlagKey(jobId), "1", "EX", 3600);
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "cancelled" },
    });
    return true;
  }
}

export { BullMQQueue };
