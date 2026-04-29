'use server';

import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { requireServerRole } from '@/lib/auth/permissions';
import { AletheiaEngine } from '@/lib/aletheia/engine';
import { Normalizer } from '@/lib/aletheia/normalizer';
import type { TariffCandidate } from '@/lib/aletheia/types';

export interface RenewalOpportunity {
    id: string;
    client_id: string;
    client_name: string;
    client_email?: string;
    current_annual_cost: number;
    best_new_annual_cost: number;
    potential_savings: number;
    savings_percent: number;
    best_tariff_name: string;
    best_marketer: string;
    priority_score: number;
    reason: string;
    status: string;
    detected_at: string;
    original_proposal_id?: string;
}

export async function getRenewalOpportunitiesAction(): Promise<RenewalOpportunity[]> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase
        .from('renewal_opportunities')
        .select(`
            id, client_id, current_annual_cost, best_new_annual_cost,
            potential_savings, savings_percent, best_tariff_name, best_marketer,
            priority_score, reason, status, detected_at, original_proposal_id,
            clients!inner(name, email)
        `)
        .in('status', ['open', 'contacted'])
        .order('priority_score', { ascending: false })
        .limit(50);

    if (error) throw new Error('Error al cargar oportunidades de renovación');

    return (data ?? []).map(row => {
        const client = row.clients as unknown as { name: string; email?: string };
        return {
            id: row.id,
            client_id: row.client_id,
            client_name: client?.name ?? 'Sin nombre',
            client_email: client?.email ?? undefined,
            current_annual_cost: Number(row.current_annual_cost),
            best_new_annual_cost: Number(row.best_new_annual_cost),
            potential_savings: Number(row.potential_savings),
            savings_percent: Number(row.savings_percent),
            best_tariff_name: row.best_tariff_name ?? '',
            best_marketer: row.best_marketer ?? '',
            priority_score: Number(row.priority_score),
            reason: row.reason,
            status: row.status,
            detected_at: row.detected_at,
            original_proposal_id: row.original_proposal_id ?? undefined,
        };
    });
}

export async function dismissRenewalAction(id: string): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    await supabase
        .from('renewal_opportunities')
        .update({ status: 'dismissed' })
        .eq('id', id);
}

export async function markRenewalContactedAction(id: string): Promise<void> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No autenticado');

    await supabase
        .from('renewal_opportunities')
        .update({ status: 'contacted', contacted_at: new Date().toISOString() })
        .eq('id', id);
}

export async function detectRenewalsAction(): Promise<{ detected: number }> {
    await requireServerRole(['admin']);
    const supabase = createServiceClient();

    const { data: proposals } = await supabase
        .from('proposals')
        .select(`
            id, client_id, agent_id, franchise_id,
            current_annual_cost, offer_annual_cost, calculation_data, offer_snapshot,
            clients!inner(name, status, cups, contracted_power, average_monthly_bill)
        `)
        .eq('status', 'accepted')
        .gt('current_annual_cost', 0);

    if (!proposals?.length) return { detected: 0 };

    const { data: tariffData } = await supabase
        .from('lv_zinergia_tarifas')
        .select('id, company, tariff_name, logo_color, offer_type, fixed_fee, power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6, energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6')
        .eq('is_active', true)
        .eq('supply_type', 'electricity');

    if (!tariffData?.length) return { detected: 0 };

    const candidates: TariffCandidate[] = tariffData.map(t => ({
        id: t.id,
        name: t.tariff_name,
        company: t.company,
        type: (t.offer_type as 'fixed' | 'indexed') || 'fixed',
        logo_color: t.logo_color,
        permanence_months: 0,
        power_price: {
            p1: Number(t.power_price_p1 || 0), p2: Number(t.power_price_p2 || 0),
            p3: Number(t.power_price_p3 || 0), p4: Number(t.power_price_p4 || 0),
            p5: Number(t.power_price_p5 || 0), p6: Number(t.power_price_p6 || 0),
        },
        energy_price: {
            p1: Number(t.energy_price_p1 || 0), p2: Number(t.energy_price_p2 || 0),
            p3: Number(t.energy_price_p3 || 0), p4: Number(t.energy_price_p4 || 0),
            p5: Number(t.energy_price_p5 || 0), p6: Number(t.energy_price_p6 || 0),
        },
        fixed_fee: Number(t.fixed_fee || 0),
    }));

    let detected = 0;

    for (const prop of proposals) {
        const calcData = prop.calculation_data as Record<string, unknown> | null;
        if (!calcData) continue;

        try {
            const normalized = Normalizer.process(calcData);
            const result = AletheiaEngine.run(normalized, candidates);

            if (!result.top_proposals?.length) continue;

            const best = result.top_proposals[0];
            const currentAnnual = Number(prop.current_annual_cost ?? 0);
            const bestNewAnnual = best.annual_cost_total;
            const savings = currentAnnual - bestNewAnnual;
            const savingsPct = currentAnnual > 0 ? (savings / currentAnnual) * 100 : 0;

            if (savings < 100 || savingsPct < 3) continue;

            const snapshot = prop.offer_snapshot as Record<string, unknown> | null;
            if (best.tariff_name === snapshot?.tariff_name) continue;

            const priorityScore = Math.min(100,
                (savingsPct * 1.5) +
                (savings > 2000 ? 30 : savings > 1000 ? 20 : savings > 500 ? 10 : 0)
            );

            await supabase
                .from('renewal_opportunities')
                .upsert({
                    client_id: prop.client_id,
                    franchise_id: prop.franchise_id,
                    agent_id: prop.agent_id,
                    original_proposal_id: prop.id,
                    current_annual_cost: currentAnnual,
                    best_new_annual_cost: bestNewAnnual,
                    potential_savings: Math.round(savings),
                    savings_percent: Math.round(savingsPct * 10) / 10,
                    best_tariff_id: best.tariff_id,
                    best_tariff_name: best.tariff_name,
                    best_marketer: best.company,
                    priority_score: Math.round(priorityScore),
                    reason: 'better_tariff',
                    status: 'open',
                    detected_at: new Date().toISOString(),
                }, { onConflict: 'client_id', ignoreDuplicates: false });

            detected++;
        } catch {
            continue;
        }
    }

    return { detected };
}
