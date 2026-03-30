'use server';

import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const clientIdsSchema = z.array(z.uuid()).min(1).max(500);

export interface ClientScore {
    clientId: string;
    score: number;       // 0-100
    reasons: string[];   // short labels explaining the score
}

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

    // ── Build scores ──
    return clientIds.map(id => {
        let score = 0;
        const reasons: string[] = [];

        // 1. Anomaly score
        const ocr = latestOcr.get(id);
        if (ocr) {
            const d = ocr.extracted_data;
            const forensic = d?.forensic_details as Record<string, unknown> | null;
            const price = d?.current_energy_price_p1 as number | undefined;
            const hasCritical = !!forensic?.reactive_penalty || (price != null && price > 0.22);
            const hasWarning = !hasCritical && (
                (d?.tariff_name as string | undefined)?.toUpperCase().includes('PVPC') ||
                (price != null && price > 0.19)
            );
            if (hasCritical) { score += 40; reasons.push('Anomalía crítica'); }
            else if (hasWarning) { score += 20; reasons.push('Anomalía detectada'); }

            // Savings potential from total_amount
            const monthly = d?.total_amount as number | undefined;
            if (monthly) {
                const annual = monthly * 12;
                if (annual > 2000) { score += 20; reasons.push('Alto potencial'); }
                else if (annual > 800) { score += 10; reasons.push('Potencial medio'); }
            }
        }

        // 2. Days without active proposal
        const prop = latestProposal.get(id);
        const meta = clientMeta.get(id);
        const noActiveProposal = !prop || prop.status === 'rejected' || prop.status === 'lost';
        if (noActiveProposal && meta?.created_at) {
            // Use client creation date when no proposal exists, otherwise last rejected/lost proposal date
            const referenceDate = !prop ? meta.created_at : (prop.created_at ?? meta.created_at);
            const daysSince = Math.floor((now - new Date(referenceDate).getTime()) / 86_400_000);
            if (!prop) {
                // New client: lower threshold — >7d is already urgent
                if (daysSince > 7) { score += 20; reasons.push('Sin propuesta'); }
                else if (daysSince > 3) { score += 10; reasons.push('Sin propuesta'); }
            } else {
                // After rejected/lost: higher threshold
                if (daysSince > 14) { score += 20; reasons.push('>14d sin propuesta'); }
                else if (daysSince > 7) { score += 12; reasons.push('>7d sin propuesta'); }
                else if (daysSince > 3) { score += 5; }
            }
        }

        // 3. Client status bonus
        const status = meta?.status;
        if (status === 'new') { score += 10; }
        else if (status === 'contacted') { score += 5; }

        return { clientId: id, score: Math.min(score, 100), reasons };
    });
}
