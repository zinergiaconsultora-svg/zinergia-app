'use server';

import { z } from 'zod';

import { requireServerRole } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { hashCups } from '@/lib/crypto/pii';
import { isValidCups, normalizeCups } from '@/lib/cnmc/sips';
import { isLiveSipsAccessEnabled } from '@/lib/sips/authorization';

/**
 * ZIN-SDD-043 consent capture.
 *
 * The raw CUPS is hashed here and never leaves this boundary: the database commands take a
 * blind index only. Every authorization decision lives in the SQL commands, which run under
 * the caller's own session, so these actions stay thin and cannot drift from the read gate.
 *
 * All of them return a discriminated result instead of throwing, because the caller is a
 * form and a thrown server-action error would surface as an opaque digest.
 */

const CONSENT_SOURCES = ['agent_confirmation', 'verbal_visit', 'signed_document', 'email'] as const;

export type SipsConsentSource = typeof CONSENT_SOURCES[number];

const recordSchema = z.object({
    cups: z.string().min(20).max(24),
    clientId: z.string().uuid().nullable().optional(),
    source: z.enum(CONSENT_SOURCES),
    notes: z.string().max(500).optional(),
});

export interface SipsConsentStatus {
    /**
     * Whether SIPS is switched on at all. When false there is nothing to consent to yet,
     * so the capture UI hides instead of prompting for an authorization that would buy the
     * agent nothing.
     */
    sipsEnabled: boolean;
    hasActiveConsent: boolean;
    consentId?: string;
    consentAt?: string;
    consentSource?: string;
    capturedByMe?: boolean;
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

const GENERIC_DENIAL = 'No puedes registrar el consentimiento de este suministro.';

async function callerClient() {
    await requireServerRole(['admin', 'franchise', 'agent']);
    return createClient();
}

/**
 * Records the holder's authorization for one supply. Idempotent: repeating it returns the
 * original consent instead of stacking rows, so a double click cannot inflate the evidence
 * trail.
 */
export async function recordSipsConsentAction(
    input: z.input<typeof recordSchema>,
): Promise<ActionResult<{ consentId: string; created: boolean }>> {
    const parsed = recordSchema.safeParse(input);
    if (!parsed.success) {
        return { success: false, error: 'Revisa los datos del consentimiento.' };
    }

    const cups = normalizeCups(parsed.data.cups);
    if (!isValidCups(cups)) {
        return { success: false, error: 'El CUPS no tiene un formato válido.' };
    }

    const supabase = await callerClient();
    const { data, error } = await supabase.rpc('record_sips_consent', {
        p_cups_hash: hashCups(cups),
        p_client_id: parsed.data.clientId ?? null,
        p_consent_source: parsed.data.source,
        p_notes: parsed.data.notes ?? null,
    });

    if (error || !data || typeof data !== 'object') {
        return { success: false, error: GENERIC_DENIAL };
    }

    const record = data as { consent_id?: string; created?: boolean };
    if (!record.consent_id) return { success: false, error: GENERIC_DENIAL };

    return { success: true, data: { consentId: record.consent_id, created: record.created === true } };
}

/** Revokes a consent. Takes effect on the next SIPS request, ahead of cache freshness. */
export async function revokeSipsConsentAction(consentId: string): Promise<ActionResult<null>> {
    if (!z.string().uuid().safeParse(consentId).success) {
        return { success: false, error: GENERIC_DENIAL };
    }

    const supabase = await callerClient();
    const { data, error } = await supabase.rpc('revoke_sips_consent', { p_consent_id: consentId });

    if (error || !data || typeof data !== 'object' || (data as { revoked?: boolean }).revoked !== true) {
        return { success: false, error: 'No se pudo revocar el consentimiento.' };
    }
    return { success: true, data: null };
}

/** Consent state for one supply, for the capture UI. Never returns consumption data. */
export async function getSipsConsentStatusAction(
    cups: string,
    clientId?: string | null,
): Promise<SipsConsentStatus> {
    // Checked before anything else: with SIPS off there is no reason to query, and no
    // reason to show the agent a prompt.
    if (!isLiveSipsAccessEnabled()) return { sipsEnabled: false, hasActiveConsent: false };

    const normalized = normalizeCups(cups);
    if (!isValidCups(normalized)) return { sipsEnabled: true, hasActiveConsent: false };

    const supabase = await callerClient();
    const { data, error } = await supabase.rpc('get_sips_consent_status', {
        p_cups_hash: hashCups(normalized),
        p_client_id: clientId ?? null,
    });

    if (error || !data || typeof data !== 'object') return { sipsEnabled: true, hasActiveConsent: false };

    const record = data as {
        has_active_consent?: boolean;
        consent_id?: string;
        consent_at?: string;
        consent_source?: string;
        captured_by_me?: boolean;
    };

    // Anything other than an explicit true is treated as "no consent".
    if (record.has_active_consent !== true) return { sipsEnabled: true, hasActiveConsent: false };

    return {
        sipsEnabled: true,
        hasActiveConsent: true,
        consentId: record.consent_id,
        consentAt: record.consent_at,
        consentSource: record.consent_source,
        capturedByMe: record.captured_by_me === true,
    };
}
