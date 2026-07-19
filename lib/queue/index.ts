import type { JobQueue } from "./types";
import { InProcessQueue } from "./in-process";

/*
 * Picks the queue backend from env (Section 6): REDIS_URL set → BullMQ (prod,
 * separate worker process); empty → in-process dev queue (no Redis). BullMQ is
 * imported lazily so local dev never loads ioredis/bullmq or tries to connect.
 */
let instance: JobQueue | undefined;

export async function getQueue(): Promise<JobQueue> {
  if (instance) return instance;

  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    // Lazy import so the dev path never loads ioredis/bullmq or connects.
    const { BullMQQueue } = await import("./bullmq");
    instance = new BullMQQueue(redisUrl);
  } else {
    instance = new InProcessQueue();
  }
  return instance;
}

export type { JobQueue };
