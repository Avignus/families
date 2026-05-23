import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Falls back gracefully when Upstash env vars are absent (local dev without Redis).
function makeRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = makeRedis();

function makeLimiter(requests: number, window: `${number} ${"s" | "m" | "h" | "d"}`) {
  if (!redis) return null;
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window) });
}

// POST /api/families/[id]/recommendations — triggers Gemini (expensive, R$/call)
export const recommendationPostLimiter = makeLimiter(4, "1 m");

// GET /api/families/[id]/recommendations + GET /api/me/recommendations
export const recommendationGetLimiter = makeLimiter(30, "1 m");

// GET /api/catalog — public, IP-keyed
export const catalogLimiter = makeLimiter(30, "1 m");

/**
 * Returns true when the request should be blocked.
 * Returns false when Redis is unconfigured (dev without env vars → allow all).
 */
export async function isRateLimited(
  limiter: Ratelimit | null,
  key: string,
): Promise<boolean> {
  if (!limiter) return false;
  const { success } = await limiter.limit(key);
  return !success;
}
