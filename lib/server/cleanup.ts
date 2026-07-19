import { prisma } from "@/lib/db";
import { getStorage, storageKeys } from "@/lib/storage";

/*
 * Result cleanup (Section 6): 2 hours after a job completes, its input and
 * output files are deleted from storage and the job is marked `expired` so the
 * download route stops serving it. Scheduled as a delayed job by the queue
 * adapter on success; also safe to run as a periodic sweep.
 *
 * Idempotent by design (Section 6 cleanup rule): deleting already-gone files is
 * a no-op, and re-expiring an expired job changes nothing — so a retried or
 * double-fired cleanup job never errors.
 */
export async function cleanupJob(jobId: string): Promise<void> {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  if (job.status === "expired") return; // already cleaned

  const storage = getStorage();
  const keys = [
    job.inputFileRef,
    job.outputFileRef,
    // Backstop: the worker deletes the secret before processing, but sweep it
    // here too so a job that never reached the worker leaves nothing behind.
    storageKeys.secret(jobId),
  ].filter((k): k is string => Boolean(k));
  for (const key of keys) {
    await storage.delete(key).catch(() => {
      // Best-effort: a missing/failed delete must not block marking expired.
    });
  }

  await prisma.job.update({
    where: { id: jobId },
    data: { status: "expired", outputFileRef: null },
  });
}

/*
 * Sweep any results whose expiresAt has passed but that weren't cleaned by their
 * delayed job (e.g. the worker was down when the timer fired). The in-process
 * queue calls this on startup; a cron/periodic BullMQ job can call it too.
 */
export async function sweepExpiredJobs(): Promise<number> {
  const due = await prisma.job.findMany({
    where: {
      status: { in: ["success", "error", "cancelled"] },
      expiresAt: { lt: new Date() },
    },
    select: { id: true },
  });
  for (const { id } of due) await cleanupJob(id);
  return due.length;
}
