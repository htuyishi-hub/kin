type Bucket = {
  count: number;
  resetAt: number; // epoch ms
};

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter.
 *
 * NOTE: For multi-instance deployments you should replace this with a shared store (Redis).
 */
export function rateLimit({
  windowMs,
  max,
  getKey,
}: {
  windowMs: number;
  max: number;
  getKey: (req: any) => string;
}) {
  return function rateLimiter(req: any, res: any, next: any) {
    const key = getKey(req);
    const now = Date.now();

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (existing.count >= max) {
      res.status(429).json({ error: "rate_limited", message: "Too many attempts" });
      return;
    }

    existing.count += 1;
    buckets.set(key, existing);
    next();
  };
}

