import type { AletheiaResult, SimulationResult, TariffPeriod } from '@/lib/aletheia/types';
import { getMarketerLogo } from '@/lib/marketers/logos';
import type { Offer, ProposalPriceSnapshot, SavingsResult } from '@/types/crm';

const PERIODS: TariffPeriod[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
const CATALOG_TARIFF_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type PriceMap = Partial<Record<TariffPeriod, number>>;

interface TariffFingerprintInput {
    id?: string | null;
    tariff_id?: string | null;
    name?: string;
    tariff_name?: string;
    company?: string;
    marketer_name?: string;
    type?: string | null;
    fixed_fee?: number | null;
    surplus_compensation_price?: number | null;
    power_price?: PriceMap;
    energy_price?: PriceMap;
    catalog_version?: number | null;
    tariff_catalog_version?: number | null;
}

export function isCatalogTariffId(id?: string | null): id is string {
    return !!id && CATALOG_TARIFF_ID_RE.test(id);
}

export function getSourceTariffId(offer?: Pick<Offer, 'id' | 'tariff_id'> | null): string | null {
    if (isCatalogTariffId(offer?.tariff_id)) return offer.tariff_id;
    if (isCatalogTariffId(offer?.id)) return offer.id;
    return null;
}

export function buildTariffPriceFingerprint(input: TariffFingerprintInput): string {
    return JSON.stringify({
        company: normalizeText(input.company ?? input.marketer_name),
        tariff_name: normalizeText(input.name ?? input.tariff_name),
        type: input.type ?? null,
        fixed_fee: round6(input.fixed_fee),
        surplus_compensation_price: round6(input.surplus_compensation_price),
        power_price: normalizePrices(input.power_price),
        energy_price: normalizePrices(input.energy_price),
        catalog_version: input.catalog_version ?? input.tariff_catalog_version ?? null,
    });
}

export function mapAletheiaProposalToSavingsResult(
    proposal: SimulationResult,
    aletheiaResult: AletheiaResult,
): SavingsResult {
    const capturedAt = new Date().toISOString();
    const candidate = proposal.candidate;
    const priceFingerprint = candidate.price_fingerprint ?? buildTariffPriceFingerprint(candidate);
    const currentAnnualCost = aletheiaResult.current_status.annual_projected_cost;

    const offer: Offer = {
        id: candidate.id,
        tariff_id: candidate.id,
        marketer_name: candidate.company,
        tariff_name: candidate.name,
        logo_color: candidate.logo_color || 'bg-blue-600',
        logo_url: getMarketerLogo(candidate.company),
        type: candidate.type,
        contract_duration: '12 meses',
        power_price: candidate.power_price,
        energy_price: candidate.energy_price,
        surplus_compensation_price: candidate.surplus_compensation_price,
        estimated_agent_commission: candidate.estimated_agent_commission,
        fixed_fee: candidate.fixed_fee,
        tariff_catalog_version: candidate.catalog_version ?? null,
        tariff_effective_from: candidate.effective_from ?? null,
        tariff_effective_to: candidate.effective_to ?? null,
        price_fingerprint: priceFingerprint,
        snapshot_at: capturedAt,
    };

    return {
        offer,
        current_annual_cost: currentAnnualCost,
        offer_annual_cost: proposal.annual_cost_total,
        annual_savings: proposal.annual_savings,
        savings_percent: currentAnnualCost > 0 ? (proposal.annual_savings / currentAnnualCost) * 100 : 0,
        calculation_audit: proposal.invoice_simulation,
        optimization_result: undefined,
    };
}

export function buildProposalPriceSnapshot(
    result: SavingsResult,
    source: ProposalPriceSnapshot['source'],
    capturedAt = result.offer.snapshot_at || new Date().toISOString(),
): ProposalPriceSnapshot {
    const offer: Offer = {
        ...result.offer,
        snapshot_at: result.offer.snapshot_at ?? capturedAt,
        price_fingerprint: result.offer.price_fingerprint ?? buildTariffPriceFingerprint(result.offer),
    };

    return {
        captured_at: capturedAt,
        source,
        tariff_id: getSourceTariffId(offer),
        offer,
        current_annual_cost: result.current_annual_cost,
        offer_annual_cost: result.offer_annual_cost,
        annual_savings: result.annual_savings,
        savings_percent: result.savings_percent,
    };
}

export function buildProposalPricingDefaults(
    result: SavingsResult,
    source: ProposalPriceSnapshot['source'],
) {
    const capturedAt = result.offer.snapshot_at || new Date().toISOString();
    const offer: Offer = {
        ...result.offer,
        snapshot_at: capturedAt,
        price_fingerprint: result.offer.price_fingerprint ?? buildTariffPriceFingerprint(result.offer),
    };
    const sourceTariffId = getSourceTariffId(offer);

    return {
        offer_snapshot: offer,
        source_tariff_id: sourceTariffId,
        price_snapshot_at: capturedAt,
        price_snapshot: buildProposalPriceSnapshot({ ...result, offer }, source, capturedAt),
        pricing_status: sourceTariffId ? 'current' as const : 'manual' as const,
        proposal_version: 1,
    };
}

function normalizePrices(prices?: PriceMap): Record<TariffPeriod, number> {
    return PERIODS.reduce((acc, period) => {
        acc[period] = round6(prices?.[period]);
        return acc;
    }, {} as Record<TariffPeriod, number>);
}

function normalizeText(value?: string | null): string {
    return (value || '').trim().toUpperCase();
}

function round6(value?: number | null): number {
    const numeric = Number(value || 0);
    return Number.isFinite(numeric) ? Math.round(numeric * 1_000_000) / 1_000_000 : 0;
}
