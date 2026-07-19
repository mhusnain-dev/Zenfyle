import type { JobQueue } from "./types";
import { processJob } from "@/lib/server/process-job";
import { cleanupJob, sweepExpiredJobs } from "@/lib/server/cleanup";
import { prisma } from "@/lib/db";

/*
 * In-process dev queue (Section 6). Runs jobs on the same Node process as the
 * Next.js server via setImmediate — no Redis, no separate worker — so the whole
 * pipeline is runnable and testable locally. NOT for production: work dies with
 * the process and there's no cross-instance coordination. BullMQQueue is the
 * production path.
 *
 * Cancellation is real here: each running job gets an AbortController, and
 * cancel() aborts it (Section 11.10). Queued-but-not-started jobs are cancelled
 * by marking the row so processJob short-circuits when it dequeues.
 */
class InProcessQueue implements JobQueue {
  private readonly controllers = new Map<string, AbortController>();
  private readonly cleanupTimers = new Map<string, NodeJS.Timeout>();
  private sweptOnce = false;

  private ensureStartupSweep() {
    // Recover results that expired while the process was down (Section 6).
    if (this.sweptOnce) return;
    this.sweptOnce = true;
    sweepExpiredJobs().catch(() => {});
  }

  async enqueue(jobId: string): Promise<void> {
    this.ensureStartupSweep();
    const controller = new AbortController();
    this.controllers.set(jobId, controller);

    // Run after the current tick so the POST handler can return "queued" first.
    setImmediate(async () => {
      try {
        const result = await processJob(jobId, controller.signal);
        if (result.status === "success") {
          // 2h cleanup (Section 6). In dev this is an in-memory timer.
          await this.scheduleCleanup(jobId, 2 * 60 * 60 * 1000);
        }
      } catch {
        // processJob marks the job row on failure; nothing to do here.
      } finally {
        this.controllers.delete(jobId);
      }
    });
  }

  async scheduleCleanup(jobId: string, delayMs: number): Promise<void> {
    const existing = this.cleanupTimers.get(jobId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      cleanupJob(jobId)
        .catch(() => {})
        .finally(() => this.cleanupTimers.delete(jobId));
    }, delayMs);
    // Don't keep the process alive just for a cleanup timer.
    timer.unref?.();
    this.cleanupTimers.set(jobId, timer);
  }

  async cancel(jobId: string): Promise<boolean> {
    const controller = this.controllers.get(jobId);
    if (controller) {
      controller.abort();
      this.controllers.delete(jobId);
      return true;
    }
    // Not currently running — cancel it if it's still queued (race: enqueued but
    // setImmediate hasn't fired, or already finished).
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      select: { status: true },
    });
    if (job && (job.status === "queued" || job.status === "processing")) {
      await prisma.job.update({
        where: { id: jobId },
        data: { status: "cancelled" },
      });
      return true;
    }
    return false;
  }
}

export { InProcessQueue };
