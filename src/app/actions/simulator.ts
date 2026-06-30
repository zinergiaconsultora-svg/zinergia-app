'use server';

import { logger } from '@/lib/utils/logger';

import { createClient } from '@/lib/supabase/server';
import { AletheiaEngine } from '@/lib/aletheia/engine';
import { Normalizer } from '@/lib/aletheia/normalizer';
import { AletheiaResult, TariffCandidate } from '@/lib/aletheia/types';
import { Result, ok, err } from '@/lib/result';
import { normalizeInvoiceData } from '@/lib/invoices/normalization';
import { buildConversionMemory, type ConversionMemory, type ProposalOutcome } from '@/lib/supervised/conversionMemory';
import { buildTariffPriceFingerprint } from '@/lib/proposals/pricing';

/**
 * Carga la memoria de conversión desde el histórico de propuestas de la
 * franquicia (RLS limita a las visibles del usuario). Cada propuesta aporta una
 * señal de "elección del agente"; las aceptadas/rechazadas añaden el cierre.
 * Agregación barata sobre offer_snapshot — no carga calculation_data.
 */
async function loadConversionMemory(
    supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<ConversionMemory> {
    const { data, error } = await supabase
        .from('proposals')
        .select('status, offer_snapshot')
        .limit(2000);

    if (error || !data) return buildConversionMemory([]);

    const outcomes: ProposalOutcome[] = [];
    for (const p of data) {
        const snap = p.offer_snapshot as { marketer_name?: string; type?: string } | null;
        const marketer = snap?.marketer_name;
        if (!marketer) continue;
        const offerType: 'fixed' | 'indexed' = snap?.type === 'indexed' ? 'indexed' : 'fixed';
        outcomes.push({ marketer, offerType, signal: 'chosen' });
        if (p.status === 'accepted') outcomes.push({ marketer, offerType, signal: 'won' });
        else if (p.status === 'rejected') outcomes.push({ marketer, offerType, signal: 'lost' });
    }

    return buildConversionMemory(outcomes);
}

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
    catalog_version?: number | null;
    effective_from?: string | null;
    effective_to?: string | null;
    price_fingerprint?: string | null;
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
        const snapshotTariffSelect = `${baseTariffSelect}, surplus_compensation_price, catalog_version, effective_from, effective_to, price_fingerprint`;

        // Filtrar el catálogo por el segmento elegido por el usuario (RESIDENCIAL/PYME),
        // que coincide con lv_zinergia_tarifas.tipo_cliente. Sustituye la heurística
        // que infería el segmento de la tarifa eléctrica (incorrecta para PYME en 2.0TD).
        const segment: 'RESIDENCIAL' | 'PYME' | undefined =
            ocrData?.segment === 'RESIDENCIAL' || ocrData?.segment === 'PYME' ? ocrData.segment : undefined;

        const buildTariffQuery = (select: string) => {
            const q = supabase
                .from('lv_zinergia_tarifas')
                .select(select)
                .eq('is_active', true)
                .eq('supply_type', 'electricity');
            return segment ? q.eq('tipo_cliente', segment) : q;
        };

        let tariffResponse = await buildTariffQuery(snapshotTariffSelect) as unknown as TariffResponse;

        if (tariffResponse.error && isMissingOptionalTariffColumn(tariffResponse.error.message)) {
            tariffResponse = await buildTariffQuery(`${baseTariffSelect}, surplus_compensation_price`) as unknown as TariffResponse;
        }

        if (tariffResponse.error && tariffResponse.error.message.includes('surplus_compensation_price')) {
            tariffResponse = await buildTariffQuery(baseTariffSelect) as unknown as TariffResponse;
        }

        const { data: tariffData, error } = tariffResponse;

        if (error) {
            logger.error('Aletheia: Error fetching tariffs', error);
            return err('Error al obtener tarifas de la base de datos.');
        }

        if (!tariffData || tariffData.length === 0) {
            return err('No hay tarifas activas configuradas en el sistema.');
        }

        const safeOcrData = normalizeInvoiceData(ocrData).invoice;
        const normalizedInvoice = Normalizer.process({
            ...safeOcrData,
            // Bridge CRM InvoiceData field names → Normalizer Spanish field names
            periodo_facturacion: safeOcrData.period_days,
            alquiler_equipos: safeOcrData.rental_cost || safeOcrData.forensic_details?.power_rental_cost,
            bono_social: safeOcrData.bono_social || safeOcrData.social_bonus_cost,
            excesos_distribuidora: safeOcrData.distribution_excess_cost || safeOcrData.excess_power_cost,
            energia_reactiva: safeOcrData.reactive_energy_cost || safeOcrData.reactive_cost,
            servicios_comerciales: safeOcrData.excluded_services_cost || safeOcrData.services_cost,
            excedentes_kwh: safeOcrData.surplus_export_kwh || safeOcrData.autoconsumo_excedentes_kwh,
            // If manual Max Demand is provided, override it
            max_demand_p1: manualMaxDemand?.p1 || safeOcrData.max_demand_p1,
            max_demand_p2: manualMaxDemand?.p2 || safeOcrData.max_demand_p2,
            max_demand_p3: manualMaxDemand?.p3 || safeOcrData.max_demand_p3,
            max_demand_p4: manualMaxDemand?.p4 || safeOcrData.max_demand_p4,
            max_demand_p5: manualMaxDemand?.p5 || safeOcrData.max_demand_p5,
            max_demand_p6: manualMaxDemand?.p6 || safeOcrData.max_demand_p6,
        });

        const commissionRows = await fetchCommissionRows(supabase, normalizedInvoice.annual_consumption_mwh);

        // 2. Map DB Tariffs to Aletheia Candidates
        const candidates: TariffCandidate[] = tariffData.map(t => {
            const estimatedCommission = estimateTariffCommission(t, commissionRows, normalizedInvoice.annual_consumption_mwh);
            const powerPrice = {
                p1: Number(t.power_price_p1 || 0),
                p2: Number(t.power_price_p2 || 0),
                p3: Number(t.power_price_p3 || 0),
                p4: Number(t.power_price_p4 || 0),
                p5: Number(t.power_price_p5 || 0),
                p6: Number(t.power_price_p6 || 0),
            };
            const energyPrice = {
                p1: Number(t.energy_price_p1 || 0),
                p2: Number(t.energy_price_p2 || 0),
                p3: Number(t.energy_price_p3 || 0),
                p4: Number(t.energy_price_p4 || 0),
                p5: Number(t.energy_price_p5 || 0),
                p6: Number(t.energy_price_p6 || 0),
            };

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
            power_price: powerPrice,
            energy_price: energyPrice,
            fixed_fee: Number(t.fixed_fee || 0),
            surplus_compensation_price: Number(t.surplus_compensation_price || 0),
            estimated_agent_commission: estimatedCommission,
            commission_source: estimatedCommission === null ? 'missing' : 'tariff_commissions',
            catalog_version: t.catalog_version ?? null,
            effective_from: t.effective_from ?? null,
            effective_to: t.effective_to ?? null,
            price_fingerprint: t.price_fingerprint ?? buildTariffPriceFingerprint({
                id: t.id,
                company: t.company,
                tariff_name: t.tariff_name,
                type: (t.offer_type as 'fixed' | 'indexed') || 'fixed',
                fixed_fee: Number(t.fixed_fee || 0),
                surplus_compensation_price: Number(t.surplus_compensation_price || 0),
                power_price: powerPrice,
                energy_price: energyPrice,
                catalog_version: t.catalog_version ?? null,
            }),
        });
        });

        // 4. Cargar memoria de conversión (aprendizaje del histórico) y ejecutar el motor
        const conversionMemory = await loadConversionMemory(supabase);
        const result = AletheiaEngine.run(normalizedInvoice, candidates, { conversionMemory, segment });

        return ok(result);

    } catch (e) {
        logger.error('Aletheia: Critical Fault', e);
        return err(`Error crítico en el motor de cálculo: ${(e as Error).message}`);
    }
}

function isMissingOptionalTariffColumn(message: string): boolean {
    return [
        'surplus_compensation_price',
        'catalog_version',
        'effective_from',
        'effective_to',
        'price_fingerprint',
    ].some(column => message.includes(column));
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

function isGenericSupplyType(product: string): boolean {
    return /^(ELECTRICIDAD|GAS|ELECTRICITY|LUZ)(_(FIJO|VARIABLE|INDEXADO))?$/.test(product);
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
        if (isGenericSupplyType(product)) {
            score += 1;
        } else if (tariffName === product || tariffName.includes(product) || product.includes(tariffName)) {
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
