import type { SupabaseClient } from '@supabase/supabase-js';

import { env } from '@/lib/env';

/**
 * ZIN-SDD-043 authorization for SIPS annual-consumption reads.
 *
 * SIPS holds the supply holder's personal data. Access is conditioned on the holder's
 * authorization, not on whether the supply happens to sit in the caller's CRM. So consent
 * is the gate; portfolio scope is defence in depth on top of it.
 *
 * Every decision is delegated to `public.authorize_sips_consumption`, which is boolean-only
 * and runs under the caller's own session. That keeps two properties the route depends on:
 * no service client is created before the request is authorized, and the cache path and the
 * live CNMC path share one contract, so they cannot drift apart.
 */

/** Safe reason codes. None of these confirm the existence of a client, supply or consent. */
export type SipsAuthorizationReason =
    | 'authorized'
    | 'unauthenticated'
    | 'account_not_active'
    | 'invalid_reference'
    | 'no_active_consent'
    | 'access_disabled'
    | 'authorization_unavailable';

export interface SipsAuthorizationDecision {
    allowed: boolean;
    reason: SipsAuthorizationReason;
}

const KNOWN_REASONS: readonly SipsAuthorizationReason[] = [
    'authorized',
    'unauthenticated',
    'account_not_active',
    'invalid_reference',
    'no_active_consent',
    'access_disabled',
    'authorization_unavailable',
];

/**
 * Operator kill path. Disables live and cached SIPS consumption reads without loosening
 * any authorization rule, so flipping it back on cannot reopen an unauthorized read.
 */
export function isLiveSipsAccessEnabled(): boolean {
    return env.SIPS_LIVE_ACCESS_ENABLED !== 'false';
}

function toDecision(value: unknown): SipsAuthorizationDecision {
    if (!value || typeof value !== 'object') {
        return { allowed: false, reason: 'authorization_unavailable' };
    }

    const record = value as { allowed?: unknown; reason?: unknown };
    const reason = KNOWN_REASONS.includes(record.reason as SipsAuthorizationReason)
        ? record.reason as SipsAuthorizationReason
        : 'authorization_unavailable';

    // Only an explicit true authorizes. An unexpected shape is a denial, never a pass.
    if (record.allowed !== true) {
        return { allowed: false, reason: reason === 'authorized' ? 'authorization_unavailable' : reason };
    }
    return { allowed: true, reason: 'authorized' };
}

/**
 * Resolves whether the current session may read SIPS consumption for this protected CUPS
 * reference. Fails closed: any error, timeout or unexpected payload denies the request and
 * never falls back to service-role access.
 *
 * @param supabase user-scoped client, so the decision runs as the caller
 * @param cupsHash blind index from `hashCups()`; the raw CUPS never reaches this layer
 */
export async function authorizeSipsConsumption(
    supabase: Pick<SupabaseClient, 'rpc'>,
    cupsHash: string,
): Promise<SipsAuthorizationDecision> {
    if (!isLiveSipsAccessEnabled()) {
        return { allowed: false, reason: 'access_disabled' };
    }

    try {
        const { data, error } = await supabase.rpc('authorize_sips_consumption', {
            p_cups_hash: cupsHash,
        });
        if (error) return { allowed: false, reason: 'authorization_unavailable' };
        return toDecision(data);
    } catch {
        return { allowed: false, reason: 'authorization_unavailable' };
    }
}
