import { describe, expect, it } from 'vitest';
import { resolveAnnualConsumption } from '../annual';

describe('resolveAnnualConsumption', () => {
    it('prefers CNMC SIPS when allowed and available', async () => {
        const result = await resolveAnnualConsumption({
            cups: 'ES0021000000000000AA1F',
            allowSips: true,
            invoice: { annual_consumption_kwh: 12000, period_days: 30, energy_p1: 1000 },
            sipsLookup: async () => ({
                cups: 'ES0021000000000000AA1F',
                annualKwh: 24000,
                annualMwh: 24,
                rows: 12,
                source: 'CNMC_SIPS',
            }),
        });

        expect(result.source).toBe('CNMC_SIPS');
        expect(result.confidence).toBe('high');
        expect(result.annualMwh).toBe(24);
    });

    it('falls back to annual consumption detected in the invoice', async () => {
        const result = await resolveAnnualConsumption({
            allowSips: false,
            invoice: { annual_consumption_kwh: 18500 },
        });

        expect(result.source).toBe('OCR_INVOICE');
        expect(result.confidence).toBe('medium');
        expect(result.annualMwh).toBe(18.5);
    });

    it('estimates annual consumption from invoice period kWh and days', async () => {
        const result = await resolveAnnualConsumption({
            invoice: {
                period_days: 30,
                energy_p1: 100,
                energy_p2: 200,
                energy_p3: 300,
                energy_p4: 0,
                energy_p5: 0,
                energy_p6: 0,
            },
        });

        expect(result.source).toBe('ESTIMATED_FROM_INVOICE');
        expect(result.confidence).toBe('low');
        expect(result.annualKwh).toBe(7300);
    });

    it('falls back when SIPS fails', async () => {
        const result = await resolveAnnualConsumption({
            cups: 'ES0021000000000000AA1F',
            allowSips: true,
            invoice: { annual_consumption_kwh: 5000 },
            sipsLookup: async () => {
                throw new Error('CNMC unavailable');
            },
        });

        expect(result.source).toBe('OCR_INVOICE');
        expect(result.annualMwh).toBe(5);
    });
});
