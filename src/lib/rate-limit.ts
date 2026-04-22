/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Intended as defense-in-depth on top of auth/API-key checks for API routes.
 * Good for single-instance / single-region Vercel deployments. For multi-region
 * or high-concurrency needs, replace with Upstash Redis (same API surface).
 *
 * Usage:
 *   const rl = rateLimit({ windowMs: 60_000, max: 60 });
 *   const { allowed, retryAfterSeconds } = rl.check(clientKey);
 *   if (!allowed) return new Response('Too Many Requests', {
 *       status: 429,
 *       headers: { 'Retry-After': String(retryAfterSeconds) },
 *   });
 */

export interface RateLimitOptions {
    /** Window size in milliseconds. */
    windowMs: number;
    /** Max requests allowed per key within the window. */
    max: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterSeconds: number;
}

interface Bucket {
    timestamps: number[];
}

export interface RateLimiter {
    check(key: string): RateLimitResult;
}

export function rateLimit({ windowMs, max }: RateLimitOptions): RateLimiter {
    const buckets = new Map<string, Bucket>();

    // Best-effort janitor: periodically drop empty buckets so the Map does not grow unbounded.
    // Runs per-call, cheap. No setInterval (serverless-friendly).
    function sweep(now: number) {
        if (buckets.size < 1024) return;
        for (const [k, b] of buckets) {
            if (b.timestamps.length === 0 || b.timestamps[b.timestamps.length - 1] < now - windowMs) {
                buckets.delete(k);
            }
        }
    }

    return {
        check(key: string): RateLimitResult {
            const now = Date.now();
            const cutoff = now - windowMs;

            let bucket = buckets.get(key);
            if (!bucket) {
                bucket = { timestamps: [] };
                buckets.set(key, bucket);
            }

            // Drop timestamps outside the window.
            while (bucket.timestamps.length > 0 && bucket.timestamps[0] < cutoff) {
                bucket.timestamps.shift();
            }

            if (bucket.timestamps.length >= max) {
                const oldest = bucket.timestamps[0];
                const retryAfterMs = Math.max(0, oldest + windowMs - now);
                return {
                    allowed: false,
                    remaining: 0,
                    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
                };
            }

            bucket.timestamps.push(now);
            sweep(now);

            return {
                allowed: true,
                remaining: Math.max(0, max - bucket.timestamps.length),
                retryAfterSeconds: 0,
            };
        },
    };
}

/**
 * Extract a client key (IP) from an incoming Request. Falls back to 'unknown'
 * if no trusted header is present.
 *
 * Trusts `x-forwarded-for` because Vercel sets it from the edge — do NOT trust
 * in self-hosted setups without an equivalent trusted reverse proxy.
 */
export function getClientKey(request: Request): string {
    const fwd = request.headers.get('x-forwarded-for');
    if (fwd) {
        // First entry is the original client.
        const first = fwd.split(',')[0]?.trim();
        if (first) return first;
    }
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
    return 'unknown';
}
