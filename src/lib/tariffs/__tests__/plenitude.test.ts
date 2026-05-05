import { describe, expect, it } from 'vitest';
import { AletheiaEngine } from '@/lib/aletheia/engine';
import type { InvoiceData } from '@/lib/aletheia/types';
import { PLENITUDE_ELECTRICITY_TARIFFS, plenitudeToTariffCandidate } from '../plenitude';

describe('Plenitude electricity tariffs', () => {
    it('loads only fixed electricity products from the PDF', () => {
        expect(PLENITUDE_ELECTRICITY_TARIFFS).toHaveLength(24);
        expect(new Set(PLENITUDE_ELECTRICITY_TARIFFS.map(t => t.product))).toEqual(new Set(['FACIL', 'PERIODOS', 'FIJO']));
        expect(PLENITUDE_ELECTRICITY_TARIFFS.every(t => t.company === 'Plenitude')).toBe(true);
        expect(PLENITUDE_ELECTRICITY_TARIFFS.some(t => t.product.includes('INDEX'))).toBe(false);
    });

    it('keeps product and tariff name separated', () => {
        const facilPower = PLENITUDE_ELECTRICITY_TARIFFS.find(t =>
            t.product === 'FACIL' && t.tariffName === 'POWER +'
        );
        const periodosPower = PLENITUDE_ELECTRICITY_TARIFFS.find(t =>
            t.product === 'PERIODOS' && t.tariffName === 'POWER +'
        );

        expect(facilPower?.tariffType).toBe('3.0TD');
        expect(periodosPower?.tariffType).toBe('3.0TD');
        expect(facilPower?.energyPrice.p1).toBe(0.162381);
        expect(periodosPower?.energyPrice.p1).toBe(0.246066);
    });

    it('uses the 15% discount energy column except PRIME', () => {
        const discounted = PLENITUDE_ELECTRICITY_TARIFFS.find(t =>
            t.product === 'FACIL' && t.tariffName === 'POWER'
        );
        const prime = PLENITUDE_ELECTRICITY_TARIFFS.find(t =>
            t.product === 'FACIL' && t.tariffName === 'PRIME'
        );

        expect(discounted?.energySource).toBe('15% dto');
        expect(discounted?.energyPrice).toMatchObject({
            p1: 0.157306,
            p6: 0.157306,
        });
        expect(prime?.energySource).toBe('sin dto');
        expect(prime?.energyPrice).toMatchObject({
            p1: 0.145126,
            p6: 0.145126,
        });
    });

    it('preserves BASSIC with two S as it appears in the PDF', () => {
        const names = PLENITUDE_ELECTRICITY_TARIFFS.map(t => t.tariffName);

        expect(names).toContain('BASSIC');
        expect(names).toContain('BASSIC 24M');
        expect(names).toContain('BASSIC 36M');
        expect(names).not.toContain('BASIC');
    });

    it('can be used by the Aletheia engine for a 3.0TD invoice calculation', () => {
        const tariff = PLENITUDE_ELECTRICITY_TARIFFS.find(t =>
            t.product === 'FACIL' && t.tariffName === 'POWER +'
        );
        expect(tariff).toBeDefined();

        const invoice: InvoiceData = {
            period_start: '2026-04-01',
            period_end: '2026-04-30',
            days_involced: 30,
            tariff_type: '3.0TD',
            contracted_power: { p1: 10, p2: 10, p3: 10, p4: 10, p5: 10, p6: 10 },
            energy_consumption: { p1: 100, p2: 100, p3: 100, p4: 100, p5: 100, p6: 100 },
            current_cost_power: 400,
            current_cost_energy: 1200,
            current_cost_reactive: 0,
            current_cost_rental: 0,
            current_total_tax_excluded: 1600,
        };

        const result = AletheiaEngine.run(invoice, [plenitudeToTariffCandidate(tariff!)]);
        const proposal = result.top_proposals[0];

        expect(proposal.company).toBe('Plenitude');
        expect(proposal.tariff_name).toBe('POWER +');
        expect(proposal.annual_cost_power).toBeCloseTo(433.18, 2);
        expect(proposal.annual_cost_energy).toBeGreaterThan(0);
        expect(proposal.annual_cost_total).toBeGreaterThan(proposal.annual_cost_power);
    });
});
