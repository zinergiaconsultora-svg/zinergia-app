import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { rateLimit, getClientKey } from '../rate-limit';

describe('rateLimit', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('allows up to `max` requests within the window', () => {
        const rl = rateLimit({ windowMs: 60_000, max: 3 });
        expect(rl.check('ip1').allowed).toBe(true);
        expect(rl.check('ip1').allowed).toBe(true);
        expect(rl.check('ip1').allowed).toBe(true);
    });

    it('blocks the (max + 1)-th request and returns retryAfterSeconds > 0', () => {
        const rl = rateLimit({ windowMs: 60_000, max: 2 });
        rl.check('ip1');
        rl.check('ip1');
        const result = rl.check('ip1');
        expect(result.allowed).toBe(false);
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
        expect(result.remaining).toBe(0);
    });

    it('tracks separate buckets per key', () => {
        const rl = rateLimit({ windowMs: 60_000, max: 1 });
        expect(rl.check('ip1').allowed).toBe(true);
        expect(rl.check('ip2').allowed).toBe(true);
        expect(rl.check('ip1').allowed).toBe(false);
        expect(rl.check('ip2').allowed).toBe(false);
    });

    it('allows requests again after the window elapses', () => {
        const rl = rateLimit({ windowMs: 60_000, max: 1 });
        expect(rl.check('ip1').allowed).toBe(true);
        expect(rl.check('ip1').allowed).toBe(false);
        vi.advanceTimersByTime(61_000);
        expect(rl.check('ip1').allowed).toBe(true);
    });

    it('decays partially: oldest timestamp drops off, new request allowed', () => {
        const rl = rateLimit({ windowMs: 10_000, max: 2 });
        rl.check('ip1');
        vi.advanceTimersByTime(5_000);
        rl.check('ip1');
        expect(rl.check('ip1').allowed).toBe(false); // 2 in window
        vi.advanceTimersByTime(6_000); // first drops off
        expect(rl.check('ip1').allowed).toBe(true);
    });
});

describe('getClientKey', () => {
    it('uses first entry of x-forwarded-for when present', () => {
        const req = new Request('https://example.com', {
            headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
        });
        expect(getClientKey(req)).toBe('1.2.3.4');
    });

    it('falls back to x-real-ip when x-forwarded-for is absent', () => {
        const req = new Request('https://example.com', {
            headers: { 'x-real-ip': '9.9.9.9' },
        });
        expect(getClientKey(req)).toBe('9.9.9.9');
    });

    it('returns "unknown" when no header is present', () => {
        const req = new Request('https://example.com');
        expect(getClientKey(req)).toBe('unknown');
    });
});
