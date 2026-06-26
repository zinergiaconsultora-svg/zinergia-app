'use server';

import { requireServerRole } from '@/lib/auth/permissions';
import { createServiceClient } from '@/lib/supabase/service';

export interface ConversionOpportunity {
    jobId: string;
    agentId: string | null;
    agentName: string | null;
    clientName: string;
    cups: string;
    currentTariff: string;
    monthlyAmount: number;
    annualEstimate: number;
    createdAt: string;
    daysAgo: number;
    extractedData: Record<string, unknown>;
}

/**
 * Devuelve facturas OCR completadas que todavía no tienen propuesta.
 * Ordenadas por importe anual estimado desc — las más rentables primero.
 */
export async function getConversionQueue(limit = 30): Promise<ConversionOpportunity[]> {
    await requireServerRole(['admin']);
    const admin = createServiceClient();

    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data: jobs, error } = await admin
        .from('ocr_jobs')
        .select('id, created_at, extracted_data, agent_id, client_id')
        .eq('status', 'completed')
        .not('extracted_data', 'is', null)
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(300);

    if (error || !jobs?.length) return [];

    // Clientes que ya tienen propuesta (cualquier estado)
    const clientIds = [...new Set(jobs.map(j => j.client_id).filter(Boolean) as string[])];
    let clientsWithProposals = new Set<string>();

    if (clientIds.length > 0) {
        const { data: proposals } = await admin
            .from('proposals')
            .select('client_id')
            .in('client_id', clientIds);
        clientsWithProposals = new Set((proposals ?? []).map(p => p.client_id));
    }

    const now = Date.now();

    const opportunities = jobs
        .filter(j => {
            if (!j.extracted_data) return false;
            const ext = j.extracted_data as Record<string, unknown>;
            if (!ext.cups) return false;
            if (j.client_id && clientsWithProposals.has(j.client_id)) return false;
            return true;
        })
        .map(j => {
            const ext = j.extracted_data as Record<string, unknown>;
            const monthlyAmount = Number(ext.total_amount ?? 0);
            const daysAgo = Math.floor((now - new Date(j.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return {
                jobId: j.id,
                agentId: j.agent_id as string | null,
                agentName: null as string | null,
                clientName: String(ext.client_name ?? 'Desconocido'),
                cups: String(ext.cups ?? '').trim().toUpperCase(),
                currentTariff: String(ext.tariff_name ?? '–'),
                monthlyAmount,
                annualEstimate: monthlyAmount * 12,
                createdAt: j.created_at,
                daysAgo,
                extractedData: ext,
            };
        })
        .sort((a, b) => {
            if (b.annualEstimate !== a.annualEstimate) return b.annualEstimate - a.annualEstimate;
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        })
        .slice(0, limit);

    // Enriquecer con nombres de agente
    const agentIds = [...new Set(opportunities.map(o => o.agentId).filter(Boolean) as string[])];
    if (agentIds.length > 0) {
        const { data: profiles } = await admin
            .from('profiles')
            .select('id, full_name')
            .in('id', agentIds);
        const pm = new Map((profiles ?? []).map(p => [p.id, p.full_name as string | null]));
        for (const opp of opportunities) {
            if (opp.agentId) opp.agentName = pm.get(opp.agentId) ?? null;
        }
    }

    return opportunities;
}
