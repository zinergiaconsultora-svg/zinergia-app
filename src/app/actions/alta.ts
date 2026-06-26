'use server';

import { requireServerRole } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

type AltaEventType =
    | 'consent_confirmed'
    | 'alta_requested'
    | 'alta_completed'
    | 'alta_rejected'
    | 'alta_reopened';

/** Append-only audit entry for an alta state transition. Best-effort: never blocks the mutation. */
async function writeAltaEvent(
    proposalId: string,
    actorId: string | null,
    eventType: AltaEventType,
    detail?: string,
    metadata?: Record<string, unknown>,
): Promise<void> {
    try {
        const admin = createServiceClient();
        await admin.from('proposal_alta_events').insert({
            proposal_id: proposalId,
            actor_id: actorId,
            event_type: eventType,
            detail: detail ?? null,
            metadata: metadata ?? {},
        });
    } catch {
        // audit is best-effort; do not fail the user action if it errors
    }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type AltaStatus =
    | 'pendiente_consent'
    | 'lista_admin'
    | 'en_alta'
    | 'activada'
    | 'rechazada';

export type RejectionReason =
    | 'cups_invalido'
    | 'titular_no_coincide'
    | 'deuda_pendiente'
    | 'baja_no_resuelta'
    | 'switch_pendiente'
    | 'otro';

export interface AltaExpediente {
    id: string;
    clientId: string;
    clientName: string;
    clientEmail: string | null;
    // NIF/IBAN are stored encrypted in clients; we surface them from calculation_data
    // (populated by OCR extraction) so the admin can copy-paste them to the portal.
    clientNif: string | null;
    clientIban: string | null;
    agentId: string | null;
    agentName: string | null;
    agentEmail: string | null;
    altaStatus: AltaStatus | null;
    consentConfirmedAt: string | null;
    sepaConfirmedAt: string | null;
    altaRequestedAt: string | null;
    altaCompletadaAt: string | null;
    altaRejectedAt: string | null;
    altaRejectionReason: RejectionReason | null;
    altaRejectionNote: string | null;
    calculationData: Record<string, unknown> | null;
    offerSnapshot: Record<string, unknown> | null;
    currentAnnualCost: number;
    offerAnnualCost: number;
    annualSavings: number;
    createdAt: string;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getAltaExpediente(proposalId: string): Promise<AltaExpediente | null> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('proposals_alta')
        .select('*')
        .eq('id', proposalId)
        .single();

    if (error || !data) return null;

    return mapExpediente(data);
}

export async function getAltaPendingQueue(): Promise<AltaExpediente[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('proposals_alta')
        .select('*')
        .in('alta_status', ['pendiente_consent', 'lista_admin', 'en_alta', 'rechazada'])
        .order('alta_requested_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(50);

    if (error || !data) return [];
    return data.map(mapExpediente);
}

export interface AltaEvent {
    id: string;
    eventType: 'consent_confirmed' | 'alta_requested' | 'alta_completed' | 'alta_rejected' | 'alta_reopened';
    detail: string | null;
    createdAt: string;
}

export async function getAltaEvents(proposalId: string): Promise<AltaEvent[]> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const { data, error } = await supabase
        .from('proposal_alta_events')
        .select('id, event_type, detail, created_at')
        .eq('proposal_id', proposalId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error || !data) return [];
    return data.map(r => ({
        id: r.id as string,
        eventType: r.event_type as AltaEvent['eventType'],
        detail: (r.detail as string) ?? null,
        createdAt: r.created_at as string,
    }));
}

function extractFromCalcData(calcData: Record<string, unknown> | null, keys: string[]): string | null {
    if (!calcData) return null;
    for (const k of keys) {
        const v = calcData[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
}

function mapExpediente(row: Record<string, unknown>): AltaExpediente {
    const calcData = (row.calculation_data as Record<string, unknown>) ?? null;
    return {
        id: row.id as string,
        clientId: row.client_id as string,
        clientName: (row.client_name as string) ?? 'Sin nombre',
        clientEmail: (row.client_email as string) ?? null,
        clientNif: extractFromCalcData(calcData, [
            'nif', 'NIF', 'dni', 'DNI', 'cif', 'CIF', 'dni_cif', 'dniCif',
            'titular_nif', 'nif_titular', 'documento', 'document_id',
        ]),
        clientIban: extractFromCalcData(calcData, [
            'iban', 'IBAN', 'bank_account', 'cuenta', 'cuenta_bancaria', 'account_number',
        ]),
        agentId: (row.agent_id as string) ?? null,
        agentName: (row.agent_name as string) ?? null,
        agentEmail: (row.agent_email as string) ?? null,
        altaStatus: (row.alta_status as AltaStatus) ?? null,
        consentConfirmedAt: (row.consent_confirmed_at as string) ?? null,
        sepaConfirmedAt: (row.sepa_confirmed_at as string) ?? null,
        altaRequestedAt: (row.alta_requested_at as string) ?? null,
        altaCompletadaAt: (row.alta_completada_at as string) ?? null,
        altaRejectedAt: (row.alta_rejected_at as string) ?? null,
        altaRejectionReason: (row.alta_rejection_reason as RejectionReason) ?? null,
        altaRejectionNote: (row.alta_rejection_note as string) ?? null,
        calculationData: (row.calculation_data as Record<string, unknown>) ?? null,
        offerSnapshot: (row.offer_snapshot as Record<string, unknown>) ?? null,
        currentAnnualCost: (row.current_annual_cost as number) ?? 0,
        offerAnnualCost: (row.offer_annual_cost as number) ?? 0,
        annualSavings: (row.annual_savings as number) ?? 0,
        createdAt: row.created_at as string,
    };
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Gate 1: Admin confirms consent artefact (contract + SEPA) is in hand. */
export async function confirmConsent(proposalId: string, sepa: boolean): Promise<{ ok: boolean; error?: string }> {
    await requireServerRole(['admin']);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'No autenticado' };

    const now = new Date().toISOString();
    const updates: Record<string, unknown> = {
        consent_confirmed_at: now,
        consent_confirmed_by: user.id,
        alta_status: 'lista_admin',
    };
    if (sepa) updates.sepa_confirmed_at = now;

    const { data, error } = await supabase
        .from('proposals')
        .update(updates)
        .eq('id', proposalId)
        .eq('status', 'accepted')
        .eq('alta_status', 'pendiente_consent')
        .select('id');

    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
        return { ok: false, error: 'No se pudo confirmar: el expediente ya no está pendiente de consentimiento.' };
    }

    await writeAltaEvent(proposalId, user.id, 'consent_confirmed', sepa ? 'Contrato + SEPA' : 'Contrato (sin SEPA)');
    revalidatePath('/dashboard');
    return { ok: true };
}

/** Gate 2: Admin submits the switch request to the distributor — starts SLA clock. */
export async function requestAlta(proposalId: string): Promise<{ ok: boolean; error?: string }> {
    await requireServerRole(['admin']);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'No autenticado' };

    // Guard: consent must be confirmed first
    const { data: proposal } = await supabase
        .from('proposals')
        .select('alta_status, consent_confirmed_at')
        .eq('id', proposalId)
        .single();

    if (!proposal?.consent_confirmed_at) {
        return { ok: false, error: 'El consentimiento del cliente no está confirmado.' };
    }
    if (proposal.alta_status !== 'lista_admin') {
        return { ok: false, error: `Estado incorrecto: ${proposal.alta_status}` };
    }

    const { data, error } = await supabase
        .from('proposals')
        .update({
            alta_status: 'en_alta',
            alta_requested_at: new Date().toISOString(),
            alta_requested_by: user.id,
        })
        .eq('id', proposalId)
        .eq('alta_status', 'lista_admin')
        .select('id');

    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
        return { ok: false, error: 'No se pudo solicitar el alta: el estado cambió mientras tanto.' };
    }

    await writeAltaEvent(proposalId, user.id, 'alta_requested', 'SLA de 10 días hábiles iniciado');
    revalidatePath('/dashboard');
    return { ok: true };
}

/** Gate 3: Admin marks the switch as completed by the distributor. */
export async function completeAlta(proposalId: string): Promise<{ ok: boolean; error?: string }> {
    await requireServerRole(['admin']);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'No autenticado' };

    const { data, error } = await supabase
        .from('proposals')
        .update({
            alta_status: 'activada',
            alta_completada_at: new Date().toISOString(),
            alta_completada_by: user.id,
        })
        .eq('id', proposalId)
        .eq('alta_status', 'en_alta')
        .select('id');

    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
        return { ok: false, error: 'No se pudo activar: el expediente no estaba en trámite.' };
    }

    await writeAltaEvent(proposalId, user.id, 'alta_completed', 'Cliente activado por la distribuidora');
    revalidatePath('/dashboard');
    return { ok: true };
}

const rejectSchema = z.object({
    proposalId: z.string().uuid(),
    reason: z.enum([
        'cups_invalido',
        'titular_no_coincide',
        'deuda_pendiente',
        'baja_no_resuelta',
        'switch_pendiente',
        'otro',
    ]),
    note: z.string().max(500).optional(),
});

/** Reject the alta at any active state — routes back to agent or admin for correction. */
export async function rejectAlta(input: z.infer<typeof rejectSchema>): Promise<{ ok: boolean; error?: string }> {
    await requireServerRole(['admin']);
    const parsed = rejectSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

    const { proposalId, reason, note } = parsed.data;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const { data, error } = await supabase
        .from('proposals')
        .update({
            alta_status: 'rechazada',
            alta_rejected_at: new Date().toISOString(),
            alta_rejection_reason: reason,
            alta_rejection_note: note ?? null,
        })
        .eq('id', proposalId)
        .in('alta_status', ['pendiente_consent', 'lista_admin', 'en_alta'])
        .select('id');

    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
        return { ok: false, error: 'No se pudo rechazar: el expediente no está en un estado activo.' };
    }

    await writeAltaEvent(proposalId, user?.id ?? null, 'alta_rejected', note?.trim() || undefined, { reason });
    revalidatePath('/dashboard');
    return { ok: true };
}

/**
 * Re-entry loop (#4): reopen a rejected alta so it can be corrected and retried.
 * Routes back to 'pendiente_consent' if consent was never confirmed, otherwise to 'lista_admin'.
 */
export async function reopenAlta(proposalId: string): Promise<{ ok: boolean; error?: string }> {
    await requireServerRole(['admin']);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: 'No autenticado' };

    const { data: proposal } = await supabase
        .from('proposals')
        .select('alta_status, consent_confirmed_at')
        .eq('id', proposalId)
        .single();

    if (proposal?.alta_status !== 'rechazada') {
        return { ok: false, error: 'Solo se pueden reabrir expedientes rechazados.' };
    }

    const target = proposal.consent_confirmed_at ? 'lista_admin' : 'pendiente_consent';

    const { data, error } = await supabase
        .from('proposals')
        .update({
            alta_status: target,
            // clear the rejection so the row is clean for the retry
            alta_rejected_at: null,
            alta_rejection_reason: null,
            alta_rejection_note: null,
        })
        .eq('id', proposalId)
        .eq('alta_status', 'rechazada')
        .select('id');

    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
        return { ok: false, error: 'No se pudo reabrir el expediente.' };
    }

    await writeAltaEvent(proposalId, user.id, 'alta_reopened', `Reabierto a estado: ${target}`);
    revalidatePath('/dashboard');
    return { ok: true };
}
