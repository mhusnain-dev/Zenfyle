import type { RateLimiter } from "./types";
import { DbRateLimiter } from "./db";

/*
 * RateLimiter selector (Section 13.4), mirroring getQueue()/getStorage(): env
 * RATE_LIMITER picks the backend. "db" (default) counts usage_events locally;
 * "redis" would use an Upstash INCR+TTL counter in production. Kept sync since
 * both implementations are cheap to construct (no connection at import time).
 */
let instance: RateLimiter | undefined;

export function getRateLimiter(): RateLimiter {
  if (instance) return instance;
  // Only the DB limiter exists today; a RedisRateLimiter slots in here behind
  // RATE_LIMITER="redis" without touching callers, same pattern as the queue.
  instance = new DbRateLimiter();
  return instance;
}

export type { RateLimiter, RateLimitIdentity, RateLimitResult } from "./types";
export { ANON_DAILY_LIMIT, USER_DAILY_LIMIT } from "./types";
