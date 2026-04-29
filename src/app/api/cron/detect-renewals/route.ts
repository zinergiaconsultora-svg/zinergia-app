import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { AletheiaEngine } from '@/lib/aletheia/engine';
import { Normalizer } from '@/lib/aletheia/normalizer';
import type { TariffCandidate } from '@/lib/aletheia/types';
import { moduleLogger } from '@/lib/logger';

const log = moduleLogger('cron:detect-renewals');
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createServiceClient();

        const { data: proposals } = await supabase
            .from('proposals')
            .select('id, client_id, agent_id, franchise_id, current_annual_cost, offer_annual_cost, calculation_data, offer_snapshot')
            .eq('status', 'accepted')
            .gt('current_annual_cost', 0);

        if (!proposals?.length) {
            log.info('No accepted proposals found');
            return NextResponse.json({ detected: 0 });
        }

        const { data: tariffData } = await supabase
            .from('lv_zinergia_tarifas')
            .select('id, company, tariff_name, logo_color, offer_type, fixed_fee, power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6, energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6')
            .eq('is_active', true)
            .eq('supply_type', 'electricity');

        if (!tariffData?.length) {
            log.info('No active tariffs');
            return NextResponse.json({ detected: 0 });
        }

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

        log.info({ detected }, 'Renewal detection complete');
        return NextResponse.json({ detected });

    } catch (error) {
        Sentry.captureException(error);
        log.error({ err: error }, 'Renewal detection cron failed');
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
