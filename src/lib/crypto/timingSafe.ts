import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Constant-time string equality for secrets (API keys, webhook tokens, etc.).
 *
 * Both sides are SHA-256 hashed first so that:
 *   - timingSafeEqual always receives equal-length buffers (it throws otherwise),
 *   - differing input lengths don't leak through an early-return timing side
 *     channel.
 *
 * Returns false if either value is null/undefined, so a missing/misconfigured
 * secret fails closed.
 */
export function safeStringEqual(a: string | null | undefined, b: string | null | undefined): boolean {
    if (a == null || b == null) return false;
    const ha = createHash('sha256').update(a, 'utf8').digest();
    const hb = createHash('sha256').update(b, 'utf8').digest();
    return timingSafeEqual(ha, hb);
}
