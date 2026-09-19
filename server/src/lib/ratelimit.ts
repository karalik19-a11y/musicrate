import type { RequestHandler } from 'express';
import { tooMany } from './errors.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-memory fixed-window limiter, keyed by client IP.
 * Enough to make brute-forcing the artist code impractical on a single instance.
 */
export function rateLimit(options: { windowMs: number; max: number }): RequestHandler {
  const buckets = new Map<string, Bucket>();

  return (req, _res, next) => {
    const now = Date.now();
    const key = req.ip ?? 'unknown';
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > options.max) {
      next(tooMany());
      return;
    }
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
    }
    next();
  };
}
