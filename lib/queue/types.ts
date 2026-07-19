/*
 * JobQueue interface (Section 6). The API layer only ever calls enqueue/cancel;
 * it never knows whether jobs run in-process (dev) or via BullMQ+Redis (prod).
 * Same swap-one-line philosophy as StorageProvider — production sets REDIS_URL
 * and gets BullMQ with stall detection, retries, and delayed cleanup jobs;
 * local dev leaves it empty and runs jobs in-process so the full
 * upload→queued→processing→download cycle is runnable with no external services.
 */
export interface JobQueue {
  /** Enqueue a job for processing. The job row must already exist (status queued). */
  enqueue(jobId: string): Promise<void>;
  /** Schedule the 2-hour cleanup for a completed job (Section 6). */
  scheduleCleanup(jobId: string, delayMs: number): Promise<void>;
  /**
   * Request cancellation (Section 11.10). Returns true if the job was still
   * cancellable (queued or in-flight). Already-finished jobs return false.
   */
  cancel(jobId: string): Promise<boolean>;
}
