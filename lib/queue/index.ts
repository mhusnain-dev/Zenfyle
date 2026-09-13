import type { JobQueue } from "./types";

/*
 * Picks the queue backend from env (Section 6): REDIS_URL set → BullMQ (prod,
 * separate worker process); empty → in-process dev queue (no Redis). Both are
 * imported lazily so (a) local dev never loads ioredis/bullmq or connects, and
 * (b) the in-process dev queue's worker pipeline (process-job → tool adapters
 * with runtime fs/path operations) is never statically reachable from a Route
 * Handler — NFT would otherwise trace the whole project for those routes.
 */
let instance: JobQueue | undefined;

export async function getQueue(): Promise<JobQueue> {
  if (instance) return instance;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    // Lazy import so the dev path never loads ioredis/bullmq or connects.
    const { BullMQQueue } = await import("./bullmq");
    instance = new BullMQQueue(redisUrl);
  } else if (process.env.NODE_ENV !== "production") {
    // Dev fallback (no Redis): in-process queue. Lazy-loaded AND gated behind
    // NODE_ENV so Turbopack constant-folds this branch away in `next build` —
    // the worker pipeline it pulls in (process-job → tool adapters with runtime
    // fs/path operations) would otherwise get traced into every route bundle as
    // if the whole project were reachable (NFT warning about next.config.ts).
    const { InProcessQueue } = await import("./in-process");
    instance = new InProcessQueue();
  } else {
    // Production requires Redis + the separate worker process (Section 6). This
    // queue is used to enqueue jobs from Route Handlers, so failing loudly here
    // beats silently running a dev-only queue with no processing worker.
    throw new Error(
      "REDIS_URL must be set in production to enqueue jobs (BullMQ + worker).",
    );
  }
  return instance;
}

export type { JobQueue };
