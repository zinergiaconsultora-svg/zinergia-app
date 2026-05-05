'use server';

import { createClient } from '@/lib/supabase/server';
import { AletheiaEngine } from '@/lib/aletheia/engine';
import { Normalizer } from '@/lib/aletheia/normalizer';
import { AletheiaResult, TariffCandidate } from '@/lib/aletheia/types';
import { Result, ok, err } from '@/lib/result';

interface TariffRow {
    id: string;
    company: string;
    tariff_name: string;
    tariff_type: string | null;
    logo_color: string | null;
    offer_type: string | null;
    fixed_fee: number | null;
    surplus_compensation_price?: number | null;
    modelo?: string | null;
    power_price_p1: number;
    power_price_p2: number;
    power_price_p3: number;
    power_price_p4: number;
    power_price_p5: number;
    power_price_p6: number;
    energy_price_p1: number;
    energy_price_p2: number;
    energy_price_p3: number;
    energy_price_p4: number;
    energy_price_p5: number;
    energy_price_p6: number;
}

interface TariffCommissionRow {
    company: string;
    modelo: string | null;
    producto_tipo: string | null;
    commission_fixed_eur: number;
    commission_variable_mwh: number;
    consumption_min_mwh: number;
    consumption_max_mwh: number;
}

interface TariffResponse {
    data: TariffRow[] | null;
    error: { message: string } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function calculateAletheiaSavings(ocrData: any, manualMaxDemand?: Record<string, number>): Promise<Result<AletheiaResult>> {
    try {
        // 1. Fetch Active Tariffs from Supabase
        const supabase = await createClient();

        // We use the same query as crmService but adapted for internal use
        // Note: Using 'lv_zinergia_tarifas' as the source of truth
        const baseTariffSelect = 'id, company, tariff_name, tariff_type, modelo, logo_color, offer_type, fixed_fee, power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6, energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6';
        let tariffResponse = await supabase
            .from('lv_zinergia_tarifas')
            .select(`${baseTariffSelect}, surplus_compensation_price`)
            .eq('is_active', true)
            .eq('supply_type', 'electricity') as unknown as TariffResponse;

        if (tariffResponse.error && tariffResponse.error.message.includes('surplus_compensation_price')) {
            tariffResponse = await supabase
                .from('lv_zinergia_tarifas')
                .select(baseTariffSelect)
                .eq('is_active', true)
                .eq('supply_type', 'electricity') as unknown as TariffResponse;
        }

        const { data: tariffData, error } = tariffResponse;

        if (error) {
            console.error('Aletheia: Error fetching tariffs', error);
            return err('Error al obtener tarifas de la base de datos.');
        }

        if (!tariffData || tariffData.length === 0) {
            return err('No hay tarifas activas configuradas en el sistema.');
        }

        const normalizedInvoice = Normalizer.process({
            ...ocrData,
            // Bridge CRM InvoiceData field names → Normalizer Spanish field names
            periodo_facturacion: ocrData.period_days,
            alquiler_equipos: ocrData.rental_cost || ocrData.forensic_details?.power_rental_cost,
            bono_social: ocrData.bono_social || ocrData.social_bonus_cost,
            excesos_distribuidora: ocrData.distribution_excess_cost || ocrData.excess_power_cost,
            energia_reactiva: ocrData.reactive_energy_cost || ocrData.reactive_cost,
            servicios_comerciales: ocrData.excluded_services_cost || ocrData.services_cost,
            excedentes_kwh: ocrData.surplus_export_kwh || ocrData.autoconsumo_excedentes_kwh,
            // If manual Max Demand is provided, override it
            max_demand_p1: manualMaxDemand?.p1 || ocrData.max_demand_p1,
            max_demand_p2: manualMaxDemand?.p2 || ocrData.max_demand_p2,
            max_demand_p3: manualMaxDemand?.p3 || ocrData.max_demand_p3,
            max_demand_p4: manualMaxDemand?.p4 || ocrData.max_demand_p4,
            max_demand_p5: manualMaxDemand?.p5 || ocrData.max_demand_p5,
            max_demand_p6: manualMaxDemand?.p6 || ocrData.max_demand_p6,
        });

        const commissionRows = await fetchCommissionRows(supabase, normalizedInvoice.annual_consumption_mwh);

        // 2. Map DB Tariffs to Aletheia Candidates
        const candidates: TariffCandidate[] = tariffData.map(t => {
            const estimatedCommission = estimateTariffCommission(t, commissionRows, normalizedInvoice.annual_consumption_mwh);
            return ({
            id: t.id,
            name: t.tariff_name,
            company: t.company,
            type: (t.offer_type as 'fixed' | 'indexed') || 'fixed',
            tariff_type: t.tariff_type || undefined,
            logo_color: t.logo_color || undefined,
            modelo: t.modelo,
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
            fixed_fee: Number(t.fixed_fee || 0),
            surplus_compensation_price: Number(t.surplus_compensation_price || 0),
            estimated_agent_commission: estimatedCommission,
            commission_source: estimatedCommission === null ? 'missing' : 'tariff_commissions',
        });
        });

        // 4. Run Engine
        const result = AletheiaEngine.run(normalizedInvoice, candidates);

        return ok(result);

    } catch (e) {
        console.error('Aletheia: Critical Fault', e);
        return err(`Error crítico en el motor de cálculo: ${(e as Error).message}`);
    }
}

async function fetchCommissionRows(
    supabase: Awaited<ReturnType<typeof createClient>>,
    annualMwh: number | undefined,
): Promise<TariffCommissionRow[]> {
    if (!annualMwh || annualMwh <= 0) return [];

    const { data, error } = await supabase
        .from('tariff_commissions')
        .select('company, modelo, producto_tipo, commission_fixed_eur, commission_variable_mwh, consumption_min_mwh, consumption_max_mwh')
        .eq('is_active', true)
        .eq('supply_type', 'electricity')
        .lte('consumption_min_mwh', annualMwh)
        .gt('consumption_max_mwh', annualMwh);

    if (error || !data) return [];
    return data as TariffCommissionRow[];
}

function estimateTariffCommission(
    tariff: TariffRow,
    rows: TariffCommissionRow[],
    annualMwh: number | undefined,
): number | null {
    if (!annualMwh || rows.length === 0) return null;

    const company = normalize(tariff.company);
    const name = normalize(tariff.tariff_name);
    const model = normalize(tariff.modelo);

    const matches = rows
        .filter(row => normalize(row.company) === company)
        .map(row => ({
            row,
            score: getCommissionMatchScore(row, name, model),
        }))
        .filter(match => match.score > 0)
        .sort((a, b) => b.score - a.score);

    const best = matches[0]?.row;
    if (!best) return null;

    return round2(Number(best.commission_fixed_eur || 0) + (annualMwh * Number(best.commission_variable_mwh || 0)));
}

function getCommissionMatchScore(row: TariffCommissionRow, tariffName: string, tariffModel: string): number {
    const product = normalize(row.producto_tipo);
    const model = normalize(row.modelo);
    let score = 1;

    if (model) {
        if (model !== tariffModel) return 0;
        score += 2;
    }

    if (product) {
        if (tariffName === product || tariffName.includes(product) || product.includes(tariffName)) {
            score += 3;
        } else {
            return 0;
        }
    }

    return score;
}

function normalize(value: string | null | undefined): string {
    return (value || '')
        .toUpperCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\+/g, ' PLUS')
        .replace(/\s+/g, ' ')
        .trim();
}

function round2(value: number): number {
    return Math.round(value * 100) / 100;
}
