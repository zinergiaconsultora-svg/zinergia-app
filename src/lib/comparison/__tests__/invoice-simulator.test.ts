import { describe, expect, it } from 'vitest';
import { detectEnergyPricingMode, simulateInvoiceComparison } from '../invoice-simulator';

const zeroPeriods = { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 };

describe('invoice simulator', () => {
    it('uses total kWh when the target tariff has a single energy price', () => {
        const result = simulateInvoiceComparison({
            days: 28,
            tariffType: '2.0TD',
            cups: 'ES0000000000000000AA',
            contractedPowerKw: { ...zeroPeriods, p1: 2.3, p2: 2.3 },
            energyKwh: { ...zeroPeriods, p1: 56, p2: 54, p3: 98 },
            currentInvoiceTotal: 55.43,
            bonoSocialAmount: 0.54,
            meterRentalAmount: 0.75,
            hasSipsAnnualConsumption: true,
        }, {
            id: 'logos-zeus-unico',
            company: 'LOGOS',
            name: 'ZEUS UNICO',
            tariffType: '2.0TD',
            powerPrice: { ...zeroPeriods, p1: 0.0894, p2: 0.044 },
            energyPrice: { ...zeroPeriods, p1: 0.1335, p2: 0.1335, p3: 0.1335 },
        });

        const energyLine = result.lines.find(line => line.label === 'Energia consumida');

        expect(result.energyPricingMode).toBe('single');
        expect(energyLine?.amount).toBeCloseTo(208 * 0.1335, 6);
        expect(result.annualSavings).toBeCloseTo((result.periodSavings / 28) * 365, 6);
    });

    it('uses period kWh when the target tariff has P1/P2/P3 prices', () => {
        const result = simulateInvoiceComparison({
            days: 28,
            tariffType: '2.0TD',
            cups: 'ES0000000000000000AA',
            contractedPowerKw: { ...zeroPeriods, p1: 2.3, p2: 2.3 },
            energyKwh: { ...zeroPeriods, p1: 56, p2: 54, p3: 98 },
            currentInvoiceTotal: 55.43,
            hasSipsAnnualConsumption: true,
        }, {
            id: 'periodic',
            company: 'TEST',
            name: 'Periodica',
            tariffType: '2.0TD',
            powerPrice: { ...zeroPeriods, p1: 0.0894, p2: 0.044 },
            energyPrice: { ...zeroPeriods, p1: 0.2, p2: 0.15, p3: 0.1 },
        });

        const energyLine = result.lines.find(line => line.label === 'Energia consumida');

        expect(result.energyPricingMode).toBe('periods');
        expect(energyLine?.amount).toBeCloseTo((56 * 0.2) + (54 * 0.15) + (98 * 0.1), 6);
    });

    it('raises quality alerts when CUPS and SIPS annual consumption are missing', () => {
        const result = simulateInvoiceComparison({
            days: 28,
            tariffType: '2.0TD',
            contractedPowerKw: { ...zeroPeriods, p1: 2.3, p2: 2.3 },
            energyKwh: { ...zeroPeriods, p1: 56, p2: 54, p3: 98 },
            currentInvoiceTotal: 55.43,
        }, {
            id: 'periodic',
            company: 'TEST',
            name: 'Periodica',
            tariffType: '2.0TD',
            powerPrice: { ...zeroPeriods, p1: 0.0894, p2: 0.044 },
            energyPrice: { ...zeroPeriods, p1: 0.2, p2: 0.15, p3: 0.1 },
        });

        expect(result.alerts.map(alert => alert.code)).toEqual(
            expect.arrayContaining(['missing_cups', 'missing_sips_consumption'])
        );
    });

    it('excludes current commercial services from the comparable invoice total', () => {
        const result = simulateInvoiceComparison({
            days: 31,
            tariffType: '3.0TD',
            cups: 'ES0000000000000000AA',
            contractedPowerKw: { p1: 22, p2: 22, p3: 22, p4: 22, p5: 22, p6: 22 },
            energyKwh: { p1: 0, p2: 302, p3: 373, p4: 0, p5: 0, p6: 846 },
            currentInvoiceTotal: 434.73,
            excludedServicesAmount: 5.05,
            vatRate: 0.21,
            bonoSocialAmount: 0.59,
            distributionExcessAmount: 3.23,
            meterRentalAmount: 1.39,
            hasSipsAnnualConsumption: true,
        }, {
            id: 'clean',
            company: 'TEST',
            name: 'Clean',
            tariffType: '3.0TD',
            powerPrice: { ...zeroPeriods, p1: 0.0558272, p2: 0.02908937, p3: 0.01227817, p4: 0.01064749, p5: 0.00688726, p6: 0.00395147 },
            energyPrice: { ...zeroPeriods, p2: 0.226424, p3: 0.20008, p6: 0.169704 },
        });

        expect(result.currentInvoiceTotal).toBeCloseTo(434.73 - (5.05 * 1.21), 2);
        expect(result.alerts.map(alert => alert.code)).toContain('services_excluded');
    });

    it('uses marketer surplus compensation price instead of copying the previous autoconsumo discount', () => {
        const result = simulateInvoiceComparison({
            days: 31,
            tariffType: '3.0TD',
            cups: 'ES0000000000000000AA',
            contractedPowerKw: { p1: 22, p2: 22, p3: 22, p4: 22, p5: 22, p6: 22 },
            energyKwh: { p1: 0, p2: 302, p3: 373, p4: 0, p5: 0, p6: 846 },
            currentInvoiceTotal: 434.73,
            surplusExportKwh: 2883,
            hasSipsAnnualConsumption: true,
        }, {
            id: 'surplus',
            company: 'TEST',
            name: 'Surplus',
            tariffType: '3.0TD',
            powerPrice: zeroPeriods,
            energyPrice: zeroPeriods,
            surplusCompensationPrice: 0.006,
        });

        const surplusLine = result.lines.find(line => line.label === 'Compensacion excedentes');

        expect(surplusLine?.amount).toBeCloseTo(-17.298, 6);
        expect(result.alerts.map(alert => alert.code)).not.toContain('missing_surplus_compensation_price');
    });

    it('warns when a self-consumption invoice has no configured surplus compensation price', () => {
        const result = simulateInvoiceComparison({
            days: 31,
            tariffType: '3.0TD',
            cups: 'ES0000000000000000AA',
            contractedPowerKw: { p1: 22, p2: 22, p3: 22, p4: 22, p5: 22, p6: 22 },
            energyKwh: { p1: 0, p2: 302, p3: 373, p4: 0, p5: 0, p6: 846 },
            currentInvoiceTotal: 434.73,
            surplusExportKwh: 2883,
            hasSipsAnnualConsumption: true,
        }, {
            id: 'missing-surplus',
            company: 'TEST',
            name: 'Missing Surplus',
            tariffType: '3.0TD',
            powerPrice: zeroPeriods,
            energyPrice: zeroPeriods,
        });

        expect(result.alerts.map(alert => alert.code)).toContain('missing_surplus_compensation_price');
    });

    it('keeps P6 consumption and copies reactive energy for complex 3.0TD invoices', () => {
        const result = simulateInvoiceComparison({
            days: 31,
            tariffType: '3.0TD',
            cups: 'ES0281000012707911BQ',
            contractedPowerKw: { p1: 0.1, p2: 18, p3: 18, p4: 18, p5: 18, p6: 18 },
            energyKwh: { p1: 24, p2: 1596, p3: 0, p4: 0, p5: 0, p6: 4593 },
            currentInvoiceTotal: 922.63,
            bonoSocialAmount: 0.40,
            distributionExcessAmount: 15.19,
            reactiveEnergyAmount: 24.70,
            meterRentalAmount: 1.39,
            electricityTaxRate: 0.0511269632,
            vatRate: 0.21,
            hasSipsAnnualConsumption: true,
        }, {
            id: 'andres-3-0',
            company: 'TEST',
            name: '3.0 con P6',
            tariffType: '3.0TD',
            powerPrice: { ...zeroPeriods, p1: 0.060484, p2: 0.03259, p3: 0.021364, p4: 0.015584, p5: 0.009139, p6: 0.0065 },
            energyPrice: { ...zeroPeriods, p1: 0.190097, p2: 0.190097, p6: 0.071958 },
        });

        const energyLine = result.lines.find(line => line.label === 'Energia consumida');
        const reactiveLine = result.lines.find(line => line.label === 'Energia reactiva');

        expect(energyLine?.amount).toBeCloseTo((24 * 0.190097) + (1596 * 0.190097) + (4593 * 0.071958), 2);
        expect(reactiveLine?.amount).toBeCloseTo(24.70, 2);
        expect(result.alerts.map(alert => alert.code)).toContain('reactive_energy_detected');
    });

    it('detects single pricing when all active periods share the same non-zero price', () => {
        expect(detectEnergyPricingMode(
            { ...zeroPeriods, p1: 0.138, p2: 0.138, p3: 0.138 },
            ['p1', 'p2', 'p3']
        )).toBe('single');
    });
});
