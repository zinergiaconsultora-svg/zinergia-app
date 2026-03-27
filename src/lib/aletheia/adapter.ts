/**
 * Aletheia Adapter
 *
 * Bridges the CRM flat InvoiceData ↔ Aletheia's structured InvoiceData,
 * and maps CRM Offer rows to Aletheia TariffCandidate objects.
 */

import { InvoiceData as CrmInvoiceData, Offer } from '@/types/crm';
import { AletheiaResult, InvoiceData as AletheiaInvoiceData, TariffCandidate, TariffPeriod } from './types';

const PERIODS: TariffPeriod[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

// ── Tariff type detection ────────────────────────────────────────────────────

function detectTariffType(inv: CrmInvoiceData): '2.0TD' | '3.0TD' | '6.1TD' {
    const hint = (inv.detected_power_type || '').toLowerCase();
    if (hint.includes('6.1')) return '6.1TD';
    if (hint.includes('3.0')) return '3.0TD';
    if (hint.includes('2.0')) return '2.0TD';

    // Fallback: count non-zero contracted power periods
    const powers = [
        inv.power_p1, inv.power_p2, inv.power_p3,
        inv.power_p4, inv.power_p5, inv.power_p6,
    ];
    const nonZero = powers.filter(p => (p || 0) > 0).length;
    if (nonZero >= 4) return '6.1TD';
    if (nonZero === 3) return '3.0TD';
    return '2.0TD';
}

// ── CRM InvoiceData → Aletheia InvoiceData ───────────────────────────────────

export function crmToAletheiaInvoice(inv: CrmInvoiceData): AletheiaInvoiceData {
    const days = inv.period_days || 30;
    const now = new Date();
    const periodEnd = now.toISOString().split('T')[0];
    const periodStart = new Date(now.getTime() - days * 86_400_000).toISOString().split('T')[0];

    const contracted_power = Object.fromEntries(
        PERIODS.map((p, i) => [p, ([inv.power_p1, inv.power_p2, inv.power_p3, inv.power_p4, inv.power_p5, inv.power_p6][i]) || 0])
    ) as Record<TariffPeriod, number>;

    const energy_consumption = Object.fromEntries(
        PERIODS.map((p, i) => [p, ([inv.energy_p1, inv.energy_p2, inv.energy_p3, inv.energy_p4, inv.energy_p5, inv.energy_p6][i]) || 0])
    ) as Record<TariffPeriod, number>;

    // Compute power cost from per-period prices if available
    const powerPrices = [
        inv.current_power_price_p1, inv.current_power_price_p2, inv.current_power_price_p3,
        inv.current_power_price_p4, inv.current_power_price_p5, inv.current_power_price_p6,
    ];
    const energyPrices = [
        inv.current_energy_price_p1, inv.current_energy_price_p2, inv.current_energy_price_p3,
        inv.current_energy_price_p4, inv.current_energy_price_p5, inv.current_energy_price_p6,
    ];

    const hasPowerPrices = powerPrices.some(v => v != null && v > 0);
    const hasEnergyPrices = energyPrices.some(v => v != null && v > 0);

    let current_cost_power = 0;
    let current_cost_energy = 0;

    if (hasPowerPrices) {
        PERIODS.forEach((p, i) => {
            current_cost_power += contracted_power[p] * (powerPrices[i] || 0) * days;
        });
    }

    if (hasEnergyPrices) {
        PERIODS.forEach((p, i) => {
            current_cost_energy += energy_consumption[p] * (energyPrices[i] || 0);
        });
    }

    // Fallback: estimate from subtotal using typical Spanish bill ratios
    // (power ~35%, energy ~55%, reactive ~5%, rental ~5%)
    if (!hasPowerPrices && !hasEnergyPrices) {
        const base = inv.subtotal || inv.total_amount || 0;
        current_cost_power = base * 0.35;
        current_cost_energy = base * 0.55;
    }

    const current_cost_reactive = inv.forensic_details?.energy_reactive ?? 0;
    const current_cost_rental = inv.forensic_details?.power_rental_cost ?? 0;
    const current_total_tax_excluded =
        inv.subtotal ||
        (current_cost_power + current_cost_energy + current_cost_reactive + current_cost_rental);

    return {
        period_start: periodStart,
        period_end: periodEnd,
        days_involced: days,
        tariff_type: detectTariffType(inv),
        contracted_power,
        energy_consumption,
        current_cost_power,
        current_cost_energy,
        current_cost_reactive,
        current_cost_rental,
        current_total_tax_excluded,
    };
}

// ── CRM Offer → Aletheia TariffCandidate ─────────────────────────────────────

export function offerToTariffCandidate(offer: Offer): TariffCandidate {
    const match = (offer.contract_duration || '').match(/\d+/);
    const permanence_months = match ? parseInt(match[0], 10) : 0;

    const toPeriodRecord = (prices: Record<string, number>): Record<TariffPeriod, number> =>
        Object.fromEntries(PERIODS.map(p => [p, prices[p] || 0])) as Record<TariffPeriod, number>;

    return {
        id: offer.id,
        name: offer.tariff_name,
        company: offer.marketer_name,
        type: offer.type ?? 'fixed',
        logo_color: offer.logo_color,
        permanence_months,
        power_price: toPeriodRecord(offer.power_price as unknown as Record<string, number>),
        energy_price: toPeriodRecord(offer.energy_price as unknown as Record<string, number>),
        fixed_fee: offer.fixed_fee ?? 0,
    };
}

// ── Aletheia AletheiaResult → n8n response shape ──────────────────────────────
// The consumer (simulatorService.calculateSavingsWithRetry) expects:
// { current_annual_cost: number, offers: Array<Offer & { annual_cost, optimization_result }> }

export function aletheiaResultToWebhookShape(result: AletheiaResult) {
    return {
        current_annual_cost: result.current_status.annual_projected_cost,
        _aletheia_fallback: true,
        offers: result.top_proposals.map(sim => ({
            id: sim.tariff_id,
            marketer_name: sim.company,
            tariff_name: sim.tariff_name,
            logo_color: sim.candidate.logo_color ?? '#10b981',
            type: sim.candidate.type,
            power_price: sim.candidate.power_price,
            energy_price: sim.candidate.energy_price,
            fixed_fee: sim.candidate.fixed_fee,
            contract_duration: sim.candidate.permanence_months > 0
                ? `${sim.candidate.permanence_months} meses`
                : 'Sin permanencia',
            annual_cost: sim.annual_cost_total,
            optimization_result: null,
        })),
    };
}
