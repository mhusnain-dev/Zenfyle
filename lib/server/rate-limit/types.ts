/*
 * RateLimiter interface (Section 13.4). Same swap-one-line philosophy as
 * StorageProvider/JobQueue: local dev counts rows in the usage_events table
 * (no Redis), production uses a Redis counter for scale. The POST /api/jobs
 * handler calls check() before enqueueing a server-side job; client-side tools
 * are never rate-limited (they cost nothing server-side, §370).
 */

export type RateLimitResult = {
  /** True if the operation is allowed (under the daily cap). */
  allowed: boolean;
  /** The cap that applied (20 anon / 50 logged-in, §13.4). */
  limit: number;
  /** Operations already used in the current window. */
  used: number;
};

export interface RateLimiter {
  /**
   * Check (without consuming) whether an identity may run another server-side
   * op today. Consumption is implicit: the handler records a usage_event on
   * success, which is what the DB limiter counts — so check() is read-only and
   * the existing usage_event write is the increment.
   */
  check(identity: RateLimitIdentity): Promise<RateLimitResult>;
}

/**
 * Who we're limiting. A logged-in user is limited by userId (higher cap, follows
 * them across IPs); an anonymous request is limited by the salted IP hash.
 */
export type RateLimitIdentity =
  | { kind: "user"; userId: string }
  | { kind: "anon"; ipHash: string };

// Daily caps (§13.4). Starting numbers, not researched optimums.
export const ANON_DAILY_LIMIT = 20;
export const USER_DAILY_LIMIT = 50;
