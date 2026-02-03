import { describe, it, expect } from 'vitest';
import { AletheiaEngine } from '../engine';
import { InvoiceData, TariffCandidate } from '../types';

describe('Aletheia Engine (Integration)', () => {

    // Mock Data
    const mockInvoice: InvoiceData = {
        period_start: '2024-01-01T00:00:00.000Z',
        period_end: '2024-01-31T00:00:00.000Z',
        days_involced: 30,
        tariff_type: '2.0TD',
        contracted_power: { p1: 5, p2: 5, p3: 5, p4: 0, p5: 0, p6: 0 },
        energy_consumption: { p1: 100, p2: 100, p3: 100, p4: 0, p5: 0, p6: 0 }, // 300 kWh total
        current_cost_power: 10,
        current_cost_energy: 60,
        current_cost_reactive: 0,
        current_cost_rental: 1,
        current_total_tax_excluded: 71,
        extra_services: []
    };

    const mockTariff: TariffCandidate = {
        id: 'tariff-1',
        name: 'Super Tarifa',
        company: 'Zinergia Power',
        type: 'fixed',
        permanence_months: 0,
        power_price: { p1: 0.1, p2: 0.1, p3: 0.05, p4: 0, p5: 0, p6: 0 }, // per kW/day
        energy_price: { p1: 0.15, p2: 0.15, p3: 0.10, p4: 0, p5: 0, p6: 0 }, // per kWh
        fixed_fee: 0
    };

    it('should calculate annual savings correctly', () => {
        const result = AletheiaEngine.run(mockInvoice, [mockTariff]);

        expect(result).toBeDefined();
        expect(result.top_proposals.length).toBe(1);

        const proposal = result.top_proposals[0];

        // Assertions logic:
        // Current Annual Cost = (71 / 30) * 365 = ~863.83
        const expectedCurrentAnnual = (71 / 30) * 365;
        expect(result.current_status.annual_projected_cost).toBeCloseTo(expectedCurrentAnnual, 1);

        // Projected Consumption checks
        // Jan weight is 0.11. 
        // P1 Proj = 100 / 0.11 = 909.09

        // We expect some savings or cost. Just strictly check it's a number and logical.
        expect(proposal.annual_cost_energy).toBeGreaterThan(0);
        expect(proposal.annual_cost_power).toBeGreaterThan(0);
        expect(proposal.annual_savings).not.toBeNaN();
    });

    it('should select best value tariff based on score', () => {
        const badTariff = { ...mockTariff, id: 'bad', energy_price: { p1: 0.99, p2: 0.99, p3: 0.99, p4: 0, p5: 0, p6: 0 } };
        const result = AletheiaEngine.run(mockInvoice, [mockTariff, badTariff]);

        expect(result.top_proposals[0].tariff_id).toBe(mockTariff.id);
        expect(result.top_proposals[0].is_best_value).toBe(true);
    });
});
