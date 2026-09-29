import { Errors } from "./errors";

/**
 * Fixed-window in-memory rate limiter.
 * Good for a single instance; for multiple instances implement the same
 * `RateLimitStore` interface on top of Redis/Postgres.
 */
export interface RateLimitStore {
  hit(key: string, windowMs: number): { count: number; resetAt: number };
}

class MemoryStore implements RateLimitStore {
  private buckets = new Map<string, { count: number; resetAt: number }>();
  hit(key: string, windowMs: number) {
    const now = Date.now();
    const b = this.buckets.get(key);
    if (!b || b.resetAt <= now) {
      const fresh = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, fresh);
      if (this.buckets.size > 10_000) this.gc(now);
      return fresh;
    }
    b.count++;
    return b;
  }
  private gc(now: number) {
    for (const [k, v] of this.buckets) if (v.resetAt <= now) this.buckets.delete(k);
  }
}

const g = globalThis as unknown as { __rateStore?: RateLimitStore };
const store: RateLimitStore = (g.__rateStore ??= new MemoryStore());

export const limits = {
  login: { limit: 10, windowMs: 15 * 60_000 },
  register: { limit: 5, windowMs: 60 * 60_000 },
  otp: { limit: 5, windowMs: 15 * 60_000 },
  passwordReset: { limit: 5, windowMs: 60 * 60_000 },
  createReport: { limit: 10, windowMs: 60 * 60_000 },
  upload: { limit: 60, windowMs: 60 * 60_000 },
  geocode: { limit: 60, windowMs: 60_000 },
  write: { limit: 120, windowMs: 60_000 },
} as const;

export function rateLimit(kind: keyof typeof limits, key: string) {
  if (process.env.RATE_LIMIT_DISABLED === "1") return;
  const { limit, windowMs } = limits[kind];
  const { count } = store.hit(`${kind}:${key}`, windowMs);
  if (count > limit) throw Errors.tooMany();
}
