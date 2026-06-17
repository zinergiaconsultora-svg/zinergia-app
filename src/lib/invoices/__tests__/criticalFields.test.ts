import { describe, it, expect } from 'vitest';
import { getMissingCriticalFields } from '../criticalFields';
import type { InvoiceData } from '@/types/crm';

function makeInvoice(overrides: Partial<InvoiceData> = {}): InvoiceData {
    return {
        period_days: 30,
        power_p1: 4.6, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
        energy_p1: 250, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
        cups: 'ES0021000000000000XY',           // 20 chars
        dni_cif: '12345678Z',
        ...overrides,
    };
}

describe('getMissingCriticalFields', () => {
    it('returns empty when all 5 critical fields are present', () => {
        expect(getMissingCriticalFields(makeInvoice())).toEqual([]);
    });

    it('accepts a 22-char CUPS', () => {
        expect(getMissingCriticalFields(makeInvoice({ cups: 'ES0021000000000000XY1P' }))).toEqual([]);
    });

    it('flags an invalid-length CUPS', () => {
        expect(getMissingCriticalFields(makeInvoice({ cups: 'ES123' }))).toContain('CUPS');
    });

    it('flags missing power, energy, days and dni', () => {
        const missing = getMissingCriticalFields(makeInvoice({
            power_p1: 0, energy_p1: 0, period_days: 0, dni_cif: '   ',
        }));
        expect(missing).toEqual(expect.arrayContaining([
            'potencia contratada', 'consumo', 'días facturados', 'DNI/CIF del titular',
        ]));
    });

    it('flags all five when the invoice is empty', () => {
        const missing = getMissingCriticalFields({
            period_days: 0,
            power_p1: 0, power_p2: 0, power_p3: 0, power_p4: 0, power_p5: 0, power_p6: 0,
            energy_p1: 0, energy_p2: 0, energy_p3: 0, energy_p4: 0, energy_p5: 0, energy_p6: 0,
        });
        expect(missing).toHaveLength(5);
    });
});
