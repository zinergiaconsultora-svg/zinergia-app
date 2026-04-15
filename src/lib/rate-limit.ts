/**
 * Lightweight in-memory sliding-window rate limiter.
 *
 * Intended for low-volume webhook endpoints (e.g. OCR callback from N8N) where a
 * full distributed limiter is overkill but we still want defense-in-depth against
 * loops/retries hammering the endpoint.
 *
 * Caveats:
 *   - State is per-process. On serverless (Vercel) cold starts reset the window.
 *     This is acceptable: legitimate N8N traffic is well below any threshold,
 *     and an attacker bypassing it via cold-start churn would still hit auth.
 *   - Memory usage is bounded by `maxKeys`; least-recently-touched keys evict.
 */

interface Bucket {
    timestamps: number[];
    lastTouched: number;
}

interface LimiterOptions {
    /** Max requests allowed per `windowMs` per key. */
    limit: number;
    /** Sliding window size in milliseconds. */
    windowMs: number;
    /** Cap on distinct keys held in memory before LRU eviction. */
    maxKeys?: number;
}

export interface RateLimitResult {
    allowed: boolean;
    /** Requests remaining in the current window. */
    remaining: number;
    /** ms until the oldest request in the window expires. */
    retryAfterMs: number;
}

export function createRateLimiter(opts: LimiterOptions) {
    const { limit, windowMs, maxKeys = 1000 } = opts;
    const buckets = new Map<string, Bucket>();

    function evictIfNeeded() {
        if (buckets.size <= maxKeys) return;
        // Evict the least-recently-touched entry (Map preserves insertion order;
        // we re-insert on touch so the oldest entry is the LRU).
        const oldestKey = buckets.keys().next().value;
        if (oldestKey !== undefined) buckets.delete(oldestKey);
    }

    return function check(key: string): RateLimitResult {
        const now = Date.now();
        const cutoff = now - windowMs;

        let bucket = buckets.get(key);
        if (bucket) {
            // Re-insert to mark as most-recently-used.
            buckets.delete(key);
        } else {
            bucket = { timestamps: [], lastTouched: now };
        }

        // Drop expired timestamps.
        bucket.timestamps = bucket.timestamps.filter(t => t > cutoff);

        const allowed = bucket.timestamps.length < limit;
        if (allowed) {
            bucket.timestamps.push(now);
        }
        bucket.lastTouched = now;

        buckets.set(key, bucket);
        evictIfNeeded();

        const oldest = bucket.timestamps[0];
        const retryAfterMs = allowed
            ? 0
            : Math.max(0, (oldest ?? now) + windowMs - now);

        return {
            allowed,
            remaining: Math.max(0, limit - bucket.timestamps.length),
            retryAfterMs,
        };
    };
}

/** Resolve client IP from common proxy headers. Falls back to "unknown". */
export function clientIpFromHeaders(headers: Headers): string {
    const xff = headers.get('x-forwarded-for');
    if (xff) return xff.split(',')[0]?.trim() || 'unknown';
    const real = headers.get('x-real-ip');
    if (real) return real.trim();
    return 'unknown';
}
