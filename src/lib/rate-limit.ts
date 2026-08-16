import { Redis } from '@upstash/redis';

type Entry = { count: number; resetAt: number };
const _store = new Map<string, Entry>();

// Prune expired entries every 5 minutes to prevent unbounded memory growth
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, e] of _store) {
      if (now > e.resetAt) _store.delete(key);
    }
  }, 5 * 60 * 1000);
  // Don't hold the process open in non-server environments
  timer.unref?.();
}

// Per-instance fallback — used automatically when Upstash isn't configured
// (e.g. local dev) and as a fail-open path if Redis is unreachable. Not
// shared across serverless instances, so it's not a reliable limit on its
// own in production; see checkRateLimit below.
function checkRateLimitInMemory(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = _store.get(key);
  if (!entry || now > entry.resetAt) {
    _store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}

const redis = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  ? new Redis({ url: process.env.UPSTASH_REDIS_REST_URL, token: process.env.UPSTASH_REDIS_REST_TOKEN })
  : null;

/**
 * Returns true if the request is allowed, false if rate-limited.
 *
 * Backed by Upstash Redis when UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN
 * are set, so the limit is actually shared and enforced across every
 * serverless instance in production — a plain in-memory Map isn't, since
 * Vercel can (and does, especially under the load an attack would cause)
 * run multiple instances that each start with an empty Map. Falls back to
 * the in-memory version when Redis isn't configured (local dev) or
 * unreachable (fail open rather than locking everyone out over an infra blip).
 */
export async function checkRateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  if (!redis) return checkRateLimitInMemory(key, limit, windowMs);

  try {
    const redisKey = `ratelimit:${key}`;
    const count = await redis.incr(redisKey);
    if (count === 1) {
      // Only the request that started this window sets its expiry —
      // otherwise every subsequent increment would push the window back out.
      await redis.pexpire(redisKey, windowMs);
    }
    return count <= limit;
  } catch {
    return checkRateLimitInMemory(key, limit, windowMs);
  }
}
