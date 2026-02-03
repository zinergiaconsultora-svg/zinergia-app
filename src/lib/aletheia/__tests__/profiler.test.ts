
import { describe, it, expect } from 'vitest';
import { Profiler } from '../profiler';
import { InvoiceData } from '../types';

// Mock minimal invoice data
const mockInvoice = (energyDist: Record<string, number>): InvoiceData => ({
    period_start: '2023-01-01',
    period_end: '2023-01-31',
    days_involced: 30,
    tariff_type: '2.0TD',
    contracted_power: { p1: 10, p2: 10, p3: 10, p4: 10, p5: 10, p6: 10 },
    max_demand: { p1: 5, p2: 5, p3: 5, p4: 5, p5: 5, p6: 5 },
    energy_consumption: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, ...energyDist },
    current_cost_power: 50,
    current_cost_energy: 50,
    current_cost_reactive: 0,
    current_cost_rental: 1,
    current_total_tax_excluded: 101
});

describe('Profiler', () => {
    it('should tag WEEKEND_WARRIOR if P6 is dominant', () => {
        const data = mockInvoice({
            p1: 10, p2: 10, p3: 10,
            p6: 800 // High P6 usage
        });
        const profile = Profiler.analyze(data);
        expect(profile.tags).toContain('WEEKEND_WARRIOR');
        expect(profile.sales_argument).toContain('horario barato');
    });

    it('should tag BUSINESS_HOURS if P1+P2 dominate', () => {
        const data = mockInvoice({
            p1: 400, p2: 400, // High Business hours
            p3: 50, p6: 100
        });
        const profile = Profiler.analyze(data);
        expect(profile.tags).toContain('BUSINESS_HOURS');
        expect(profile.sales_argument).toContain('horario comercial');
    });

    it('should tag FLAT_PROFILE if usage is balanced', () => {
        const data = mockInvoice({
            p1: 100, p2: 100, p3: 100,
            p4: 100, p5: 100,
            p6: 100
        });
        // max share is 16% (100/600).
        const profile = Profiler.analyze(data);
        expect(profile.tags).toContain('FLAT_PROFILE');
    });

    it('should tag HIGH_VOLTAGE for 6.1TD tariffs', () => {
        const data = mockInvoice({ p1: 100 });
        data.tariff_type = '6.1TD';

        const profile = Profiler.analyze(data);
        expect(profile.tags).toContain('HIGH_VOLTAGE');
    });
});
