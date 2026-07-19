import { prisma } from "@/lib/db";
import {
  ANON_DAILY_LIMIT,
  USER_DAILY_LIMIT,
  type RateLimiter,
  type RateLimitIdentity,
  type RateLimitResult,
} from "./types";

/*
 * DB-backed rate limiter (Section 13.4) — the local-dev implementation, no
 * Redis. Counts usage_events rows since the start of the current UTC day for
 * the identity: by userId for logged-in users (50/day), by ipHash for anon
 * (20/day). The POST /api/jobs handler already writes a usage_event per
 * successful enqueue, so that row IS the increment — check() only reads.
 *
 * Note: at real scale a COUNT-since-midnight query per request would favour a
 * Redis INCR with a TTL (the production RedisRateLimiter), but for solo dev the
 * usage_events table is indexed on (ipHash, createdAt) and this is exact.
 */
function startOfUtcDay(now: Date): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
}

export class DbRateLimiter implements RateLimiter {
  async check(identity: RateLimitIdentity): Promise<RateLimitResult> {
    const since = startOfUtcDay(new Date());
    const limit =
      identity.kind === "user" ? USER_DAILY_LIMIT : ANON_DAILY_LIMIT;

    const where =
      identity.kind === "user"
        ? { userId: identity.userId, createdAt: { gte: since } }
        : { ipHash: identity.ipHash, createdAt: { gte: since } };

    const used = await prisma.usageEvent.count({ where });
    return { allowed: used < limit, limit, used };
  }
}
