'use server';

import { createClient } from '@/lib/supabase/server';
import { AletheiaEngine } from '@/lib/aletheia/engine';
import { Normalizer } from '@/lib/aletheia/normalizer';
import { AletheiaResult, InvoiceData, TariffCandidate } from '@/lib/aletheia/types';
import { Result, ok, err } from '@/lib/result';

export async function calculateAletheiaSavings(ocrData: any, manualMaxDemand?: any): Promise<Result<AletheiaResult>> {
    try {
        console.log('🔮 Aletheia: Starting calculation...');

        // 1. Fetch Active Tariffs from Supabase
        const supabase = await createClient();

        // We use the same query as crmService but adapted for internal use
        // Note: Using 'lv_zinergia_tarifas' as the source of truth
        const { data: tariffData, error } = await supabase
            .from('lv_zinergia_tarifas')
            .select('*')
            .eq('is_active', true);

        if (error) {
            console.error('Aletheia: Error fetching tariffs', error);
            return err('Error al obtener tarifas de la base de datos.');
        }

        if (!tariffData || tariffData.length === 0) {
            return err('No hay tarifas activas configuradas en el sistema.');
        }

        // 2. Map DB Tariffs to Aletheia Candidates
        const candidates: TariffCandidate[] = tariffData.map(t => ({
            id: t.id,
            name: t.tariff_name,
            company: t.company,
            type: (t.offer_type as 'fixed' | 'indexed') || 'fixed',
            logo_color: t.logo_color,
            permanence_months: 0, // Default to 0 if not in DB, or parse 'contract_duration' if it contains numbers
            // Mapping prices directly
            power_price: {
                p1: Number(t.power_price_p1 || 0),
                p2: Number(t.power_price_p2 || 0),
                p3: Number(t.power_price_p3 || 0),
                p4: Number(t.power_price_p4 || 0),
                p5: Number(t.power_price_p5 || 0),
                p6: Number(t.power_price_p6 || 0),
            },
            energy_price: {
                p1: Number(t.energy_price_p1 || 0),
                p2: Number(t.energy_price_p2 || 0),
                p3: Number(t.energy_price_p3 || 0),
                p4: Number(t.energy_price_p4 || 0),
                p5: Number(t.energy_price_p5 || 0),
                p6: Number(t.energy_price_p6 || 0),
            },
            fixed_fee: Number(t.fixed_fee || 0)
        }));

        // 3. Process Input Data (OCR + Manual Overrides)
        // We assume 'ocrData' comes from the 'analyzeDocument' output (CRM InvoiceData)
        // We'll map it to Aletheia's InvoiceData expectation

        // Construct raw object for Normalizer
        const rawInput = {
            ...ocrData,
            // If manual Max Demand is provided, override it
            max_demand_p1: manualMaxDemand?.p1 || ocrData.max_demand_p1,
            max_demand_p2: manualMaxDemand?.p2 || ocrData.max_demand_p2,
            max_demand_p3: manualMaxDemand?.p3 || ocrData.max_demand_p3,
            max_demand_p4: manualMaxDemand?.p4 || ocrData.max_demand_p4,
            max_demand_p5: manualMaxDemand?.p5 || ocrData.max_demand_p5,
            max_demand_p6: manualMaxDemand?.p6 || ocrData.max_demand_p6,
        };

        const normalizedInvoice = Normalizer.process(rawInput);

        console.log(`Aletheia: Normalized Invoice (Days=${normalizedInvoice.days_involced})`);

        // 4. Run Engine
        const result = AletheiaEngine.run(normalizedInvoice, candidates);

        console.log('Aletheia: Calculation complete. Top offer savings:', result.top_proposals[0]?.annual_savings);

        return ok(result);

    } catch (e) {
        console.error('Aletheia: Critical Fault', e);
        return err(`Error crítico en el motor de cálculo: ${(e as Error).message}`);
    }
}
