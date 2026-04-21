'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { computeClientScore, type ClientScore } from '@/lib/crm/clientScoring';

export type { ClientScore };

const clientIdsSchema = z.array(z.uuid()).min(1).max(500);

/**
 * Computes priority scores for a list of client IDs.
 * Score breakdown (max 100):
 *   - Critical anomaly in last OCR job:  +40
 *   - Warning anomaly (no critical):     +20
 *   - High savings potential (>2000€/y): +20 | medium (>800€): +10
 *   - No proposal in >14 days:           +20 | >7 days: +12 | >3 days: +5
 *   - Client status new/contacted:       +10 / +5
 */
export async function getClientScoresAction(clientIds: string[]): Promise<ClientScore[]> {
    if (clientIds.length === 0) return [];

    const parsed = clientIdsSchema.safeParse(clientIds);
    if (!parsed.success) return []; // entrada inválida — falla silenciosa (no crítico)

    const supabase = await createClient();
    const now = Date.now();

    // ── Latest completed OCR job per client ──
    const { data: ocrJobs } = await supabase
        .from('ocr_jobs')
        .select('client_id, extracted_data, created_at')
        .in('client_id', clientIds)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

    // Keep only the latest job per client
    const latestOcr = new Map<string, { extracted_data: Record<string, unknown>; created_at: string }>();
    (ocrJobs ?? []).forEach(j => {
        if (j.client_id && !latestOcr.has(j.client_id)) {
            latestOcr.set(j.client_id, { extracted_data: j.extracted_data as Record<string, unknown>, created_at: j.created_at });
        }
    });

    // ── Latest proposal per client ──
    const { data: proposals } = await supabase
        .from('proposals')
        .select('client_id, created_at, status')
        .in('client_id', clientIds)
        .order('created_at', { ascending: false });

    const latestProposal = new Map<string, { created_at: string; status: string }>();
    (proposals ?? []).forEach(p => {
        if (!latestProposal.has(p.client_id)) {
            latestProposal.set(p.client_id, { created_at: p.created_at, status: p.status });
        }
    });

    // ── Client status ──
    const { data: clients } = await supabase
        .from('clients')
        .select('id, status, created_at')
        .in('id', clientIds);

    const clientMeta = new Map<string, { status: string; created_at: string }>();
    (clients ?? []).forEach(c => clientMeta.set(c.id, { status: c.status, created_at: c.created_at }));

    // ── Build scores using pure computeClientScore ──
    return clientIds.map(id => {
        const ocrJob = latestOcr.get(id);
        const ocrData = ocrJob
            ? {
                forensic_details: ocrJob.extracted_data?.forensic_details as { reactive_penalty?: unknown } | null,
                current_energy_price_p1: ocrJob.extracted_data?.current_energy_price_p1 as number | null,
                tariff_name: ocrJob.extracted_data?.tariff_name as string | null,
                total_amount: ocrJob.extracted_data?.total_amount as number | null,
            }
            : null;

        return computeClientScore(
            id,
            ocrData,
            latestProposal.get(id) ?? null,
            clientMeta.get(id) ?? null,
            now,
        );
    });
}
