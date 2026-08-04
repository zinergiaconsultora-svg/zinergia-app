import { describe, expect, it } from 'vitest';

import {
    DEFAULT_SSA_MARKET_RATE_EUR_MWH,
    calculateAdjustmentServicesCost,
    simulateInvoiceComparison,
    type SsaTreatment,
    type TariffSimulationInput,
} from '../invoice-simulator';

const zeroPeriods = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 };

// 1.000 kWh = 1 MWh, so the euro amounts below read directly as the EUR/MWh rate.
const ONE_MWH = { ...zeroPeriods, p1: 1000 };

function invoice(overrides: Partial<Parameters<typeof simulateInvoiceComparison>[0]> = {}) {
    return {
        days: 30,
        tariffType: '2.0TD',
        cups: 'ES0000000000000000AA',
        contractedPowerKw: { ...zeroPeriods, p1: 3, p2: 3 },
        energyKwh: ONE_MWH,
        currentInvoiceTotal: 300,
        hasSipsAnnualConsumption: true,
        ...overrides,
    };
}

function tariff(overrides: Partial<TariffSimulationInput> = {}): TariffSimulationInput {
    return {
        id: 'candidate',
        company: 'TEST',
        name: 'Candidata',
        tariffType: '2.0TD',
        powerPrice: { ...zeroPeriods, p1: 0.09, p2: 0.04 },
        energyPrice: { ...zeroPeriods, p1: 0.13, p2: 0.13, p3: 0.13 },
        ...overrides,
    };
}

function ssaLineAmount(treatment: SsaTreatment, extra: Partial<TariffSimulationInput> = {}) {
    const result = simulateInvoiceComparison(
        invoice({ ssaMarketRateEurMwh: 20 }),
        tariff({ ssaTreatment: treatment, ...extra }),
    );
    return result.lines.find(line => line.label === 'Servicios de ajuste')?.amount ?? null;
}

describe('adjustment services (SSA) normalisation', () => {
    describe('calculateAdjustmentServicesCost', () => {
        it('adds nothing when the marketer bundles SSA into the energy price', () => {
            expect(calculateAdjustmentServicesCost(1000, 'included', 20)).toBe(0);
        });

        it('charges the full market rate per MWh when SSA are billed separately', () => {
            expect(calculateAdjustmentServicesCost(1000, 'billed_separately', 20)).toBeCloseTo(20, 6);
            expect(calculateAdjustmentServicesCost(2500, 'billed_separately', 20)).toBeCloseTo(50, 6);
        });

        it('charges only the excess over the cap when SSA are included with a cap', () => {
            expect(calculateAdjustmentServicesCost(1000, 'included_with_cap', 20, 12)).toBeCloseTo(8, 6);
        });

        it('charges nothing when the market rate sits below the included cap', () => {
            expect(calculateAdjustmentServicesCost(1000, 'included_with_cap', 10, 12)).toBe(0);
        });

        it('adds nothing when the treatment is unknown, so the cost is never invented', () => {
            expect(calculateAdjustmentServicesCost(1000, 'unknown', 20)).toBe(0);
        });

        it('returns zero for zero or negative consumption', () => {
            expect(calculateAdjustmentServicesCost(0, 'billed_separately', 20)).toBe(0);
            expect(calculateAdjustmentServicesCost(-500, 'billed_separately', 20)).toBe(0);
        });
    });

    describe('simulateInvoiceComparison', () => {
        it('exposes one SSA line per treatment with the normalised amount', () => {
            expect(ssaLineAmount('included')).toBe(0);
            expect(ssaLineAmount('billed_separately')).toBeCloseTo(20, 6);
            expect(ssaLineAmount('included_with_cap', { ssaIncludedEurMwh: 12 })).toBeCloseTo(8, 6);
            expect(ssaLineAmount('unknown')).toBe(0);
        });

        // This is the regression the whole change exists to prevent: two offers with the
        // same energy price must not tie when one of them bills SSA on top.
        it('ranks a bundled offer cheaper than an identically priced offer that bills SSA separately', () => {
            const bundled = simulateInvoiceComparison(
                invoice({ ssaMarketRateEurMwh: 20 }),
                tariff({ id: 'bundled', ssaTreatment: 'included' }),
            );
            const separate = simulateInvoiceComparison(
                invoice({ ssaMarketRateEurMwh: 20 }),
                tariff({ id: 'separate', ssaTreatment: 'billed_separately' }),
            );

            expect(separate.subtotalBeforeTax - bundled.subtotalBeforeTax).toBeCloseTo(20, 6);
            expect(separate.simulatedInvoiceTotal).toBeGreaterThan(bundled.simulatedInvoiceTotal);
            expect(separate.annualSavings).toBeLessThan(bundled.annualSavings);
        });

        it('carries SSA through electricity tax and VAT like any other energy concept', () => {
            const withSsa = simulateInvoiceComparison(
                invoice({ ssaMarketRateEurMwh: 20, electricityTaxRate: 0.0511, vatRate: 0.21 }),
                tariff({ ssaTreatment: 'billed_separately' }),
            );
            const withoutSsa = simulateInvoiceComparison(
                invoice({ ssaMarketRateEurMwh: 20, electricityTaxRate: 0.0511, vatRate: 0.21 }),
                tariff({ ssaTreatment: 'included' }),
            );

            const expectedDelta = 20 * 1.0511 * 1.21;
            expect(withSsa.simulatedInvoiceTotal - withoutSsa.simulatedInvoiceTotal)
                .toBeCloseTo(expectedDelta, 6);
        });

        it('warns when the tariff does not declare how it treats SSA', () => {
            const result = simulateInvoiceComparison(invoice(), tariff());

            const alert = result.alerts.find(entry => entry.code === 'missing_ssa_treatment');
            expect(alert?.level).toBe('warning');
        });

        it('does not warn about a missing treatment once the tariff declares one', () => {
            const result = simulateInvoiceComparison(
                invoice(),
                tariff({ ssaTreatment: 'included' }),
            );

            expect(result.alerts.find(entry => entry.code === 'missing_ssa_treatment')).toBeUndefined();
        });

        it('flags the assumed market rate when a priced treatment gets no configured reference', () => {
            const result = simulateInvoiceComparison(
                invoice(),
                tariff({ ssaTreatment: 'billed_separately' }),
            );

            const alert = result.alerts.find(entry => entry.code === 'ssa_market_rate_assumed');
            expect(alert?.level).toBe('info');
            const ssaLine = result.lines.find(line => line.label === 'Servicios de ajuste');
            expect(ssaLine?.amount).toBeCloseTo(DEFAULT_SSA_MARKET_RATE_EUR_MWH, 6);
        });

        it('does not flag an assumed rate when the reference is supplied', () => {
            const result = simulateInvoiceComparison(
                invoice({ ssaMarketRateEurMwh: 18 }),
                tariff({ ssaTreatment: 'billed_separately' }),
            );

            expect(result.alerts.find(entry => entry.code === 'ssa_market_rate_assumed')).toBeUndefined();
        });

        it('does not flag an assumed rate for a bundled tariff, which never needs one', () => {
            const result = simulateInvoiceComparison(invoice(), tariff({ ssaTreatment: 'included' }));

            expect(result.alerts.find(entry => entry.code === 'ssa_market_rate_assumed')).toBeUndefined();
        });

        // Without this the current cost is understated and every saving is inflated.
        it('counts separately billed SSA as current cost when rebuilding the invoice total', () => {
            const base = { currentInvoiceTotal: undefined, currentPowerCost: 40, currentEnergyCost: 160 };
            const withoutSsa = simulateInvoiceComparison(
                invoice(base),
                tariff({ ssaTreatment: 'included' }),
            );
            const withSsa = simulateInvoiceComparison(
                invoice({ ...base, ssaAmount: 20 }),
                tariff({ ssaTreatment: 'included' }),
            );

            expect(withSsa.currentInvoiceTotal).toBeGreaterThan(withoutSsa.currentInvoiceTotal);
            expect(withSsa.periodSavings).toBeGreaterThan(withoutSsa.periodSavings);
        });
    });
});
