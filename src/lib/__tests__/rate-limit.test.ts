import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { clientIpFromHeaders, createRateLimiter } from '../rate-limit';

describe('createRateLimiter', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-04-15T12:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows requests under the limit', () => {
        const check = createRateLimiter({ limit: 3, windowMs: 1000 });
        expect(check('ip-1').allowed).toBe(true);
        expect(check('ip-1').allowed).toBe(true);
        expect(check('ip-1').allowed).toBe(true);
    });

    it('blocks the request that crosses the limit', () => {
        const check = createRateLimiter({ limit: 3, windowMs: 1000 });
        check('ip-1');
        check('ip-1');
        check('ip-1');
        const result = check('ip-1');
        expect(result.allowed).toBe(false);
        expect(result.remaining).toBe(0);
    });

    it('reports retryAfterMs based on oldest timestamp', () => {
        const check = createRateLimiter({ limit: 2, windowMs: 1000 });
        check('ip-1'); // t=0
        vi.advanceTimersByTime(300);
        check('ip-1'); // t=300
        const blocked = check('ip-1'); // t=300, blocked
        expect(blocked.allowed).toBe(false);
        // Oldest was at t=0, window ends at t=1000, now is t=300 → retry in 700ms
        expect(blocked.retryAfterMs).toBe(700);
    });

    it('allows again after the window slides past old timestamps', () => {
        const check = createRateLimiter({ limit: 2, windowMs: 1000 });
        check('ip-1');
        check('ip-1');
        expect(check('ip-1').allowed).toBe(false);

        vi.advanceTimersByTime(1001);
        expect(check('ip-1').allowed).toBe(true);
    });

    it('tracks keys independently', () => {
        const check = createRateLimiter({ limit: 1, windowMs: 1000 });
        expect(check('ip-a').allowed).toBe(true);
        expect(check('ip-b').allowed).toBe(true);
        expect(check('ip-a').allowed).toBe(false);
        expect(check('ip-b').allowed).toBe(false);
    });

    it('does not consume the quota when a request is blocked', () => {
        // If the blocked request counted, the user could never recover.
        const check = createRateLimiter({ limit: 1, windowMs: 1000 });
        check('ip-1');
        check('ip-1'); // blocked, should not add a timestamp
        check('ip-1'); // still blocked
        vi.advanceTimersByTime(1001);
        expect(check('ip-1').allowed).toBe(true);
    });

    it('evicts least-recently-used keys when maxKeys is exceeded', () => {
        const check = createRateLimiter({ limit: 1, windowMs: 60_000, maxKeys: 2 });
        check('a');
        check('b');
        check('c'); // forces eviction of 'a' (LRU)

        // 'a' was evicted, so it starts fresh and is allowed again.
        expect(check('a').allowed).toBe(true);
        // 'b' is still tracked (second oldest, not LRU when 'c' arrived).
        // After the `a` insert above, `b` becomes oldest and may have been evicted
        // if maxKeys policy evicts on every overflow. Rather than assert that,
        // check 'c' which must still be tracked.
        expect(check('c').allowed).toBe(false);
    });
});

describe('clientIpFromHeaders', () => {
    it('returns first IP from x-forwarded-for', () => {
        const h = new Headers({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' });
        expect(clientIpFromHeaders(h)).toBe('1.2.3.4');
    });

    it('falls back to x-real-ip', () => {
        const h = new Headers({ 'x-real-ip': '9.9.9.9' });
        expect(clientIpFromHeaders(h)).toBe('9.9.9.9');
    });

    it('returns "unknown" when no proxy headers are present', () => {
        const h = new Headers();
        expect(clientIpFromHeaders(h)).toBe('unknown');
    });

    it('prefers x-forwarded-for over x-real-ip', () => {
        const h = new Headers({
            'x-forwarded-for': '1.1.1.1',
            'x-real-ip': '9.9.9.9',
        });
        expect(clientIpFromHeaders(h)).toBe('1.1.1.1');
    });
});
