
import { describe, it, expect } from 'vitest';
import { Auditor } from '../auditor';
import { InvoiceData } from '../types';
import { THRESHOLDS } from '../config';

// Mock minimal invoice data
const mockInvoice = (overrides?: Partial<InvoiceData>): InvoiceData => ({
    period_start: '2023-01-01',
    period_end: '2023-01-31',
    days_involced: 30,
    tariff_type: '3.0TD',
    contracted_power: { p1: 50, p2: 50, p3: 50, p4: 50, p5: 50, p6: 50 },
    max_demand: { p1: 40, p2: 40, p3: 40, p4: 40, p5: 40, p6: 40 },
    energy_consumption: { p1: 100, p2: 100, p3: 100, p4: 100, p5: 100, p6: 100 },
    current_cost_power: 100,
    current_cost_energy: 100,
    current_cost_reactive: 0,
    current_cost_rental: 10,
    current_total_tax_excluded: 210,
    ...overrides
});

describe('Auditor', () => {
    describe('Reactive Power Optimization', () => {
        it('should detect reactive penalties and suggest capacitor bank', () => {
            const data = mockInvoice({
                current_cost_reactive: 150 // 150€ penalty in one month
            });

            const opps = Auditor.audit(data);
            const reactiveOpp = opps.find(o => o.type === 'REACTIVE_COMPENSATION');

            expect(reactiveOpp).toBeDefined();
            expect(reactiveOpp?.annual_savings).toBeCloseTo(150 / 30 * 365, 0); // Approx 1825
            expect(reactiveOpp?.investment_cost).toBeGreaterThan(0);
            expect(reactiveOpp?.roi_months).toBeLessThan(12); // Should pay back quickly
            expect(reactiveOpp?.priority).toBe('HIGH');
        });

        it('should NOT suggest capacitor bank if no reactive penalty', () => {
            const data = mockInvoice({
                current_cost_reactive: 0
            });
            const opps = Auditor.audit(data);
            const reactiveOpp = opps.find(o => o.type === 'REACTIVE_COMPENSATION');
            expect(reactiveOpp).toBeUndefined();
        });
    });

    describe('Power Optimization', () => {
        it('should detect excess contracted power', () => {
            const data = mockInvoice({
                contracted_power: { p1: 100, p2: 100, p3: 100, p4: 100, p5: 100, p6: 100 },
                max_demand: { p1: 40, p2: 40, p3: 40, p4: 40, p5: 40, p6: 40 } // Using 40% of capacity
            });

            const opps = Auditor.audit(data);
            const powerOpp = opps.find(o => o.type === 'POWER_OPTIMIZATION');

            expect(powerOpp).toBeDefined();
            expect(powerOpp?.annual_savings).toBeGreaterThan(0);
            expect(powerOpp?.priority).toBe('HIGH');
            expect(powerOpp?.title).toContain('Exceso de Potencia');
        });

        it('should NOT suggest reduction if buffer is tight', () => {
            // THRESHOLDS.POWER_BLOAT_BUFFER is usually around 10-15%
            const max = 50;
            const contracted = max * 1.05; // Only 5% buffer, safe enough

            const data = mockInvoice({
                contracted_power: { p1: contracted, p2: contracted, p3: contracted, p4: contracted, p5: contracted, p6: contracted },
                max_demand: { p1: max, p2: max, p3: max, p4: max, p5: max, p6: max }
            });

            const opps = Auditor.audit(data);
            const powerOpp = opps.find(o => o.type === 'POWER_OPTIMIZATION');

            // Should be undefined because the saving logic requires contracted > max * buffer
            // If the buffer logic is correct, this might trigger if buffer < 5%? 
            // Checking auditor.ts: if (contracted > (max * (1 + THRESHOLDS.POWER_BLOAT_BUFFER)))
            // If buffer is 0.15 (15%), then 1.05 is NOT > 1.15. So no opportunity.
            expect(powerOpp).toBeUndefined();
        });
    });
});
