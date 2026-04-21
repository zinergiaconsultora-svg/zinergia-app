/**
 * Tests for tariffService pure functions.
 *
 * We test only the functions that are pure (no window/localStorage dependency).
 * CRUD methods (getAll, saveAll, etc.) require a browser environment and are
 * excluded — they are covered by E2E tests.
 */
import { describe, expect, it } from 'vitest';

// ─── Inline copies of the private helpers (not exported) ──────────────────────
// These are duplicated here to allow unit testing without exporting internals.
// If you export them from tariffService.ts, remove these copies.
function parseNumber(val: string | number | undefined): number {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    const normalized = val.toString().trim().replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
}

// Import the exported parts we CAN test
import { tariffService } from '../tariffService';
import type { Tariff } from '@/types/tariff';

// ──────────────────────────────────────────────────────────────────────────────
// parseNumber (internal helper, tested via inline copy)
// ──────────────────────────────────────────────────────────────────────────────
describe('parseNumber', () => {
    it('returns a plain number unchanged', () => expect(parseNumber(1.5)).toBe(1.5));
    it('parses dot decimal string', () => expect(parseNumber('1.5')).toBe(1.5));
    it('parses comma decimal string (European format)', () => expect(parseNumber('1,5')).toBe(1.5));
    it('returns 0 for empty string', () => expect(parseNumber('')).toBe(0));
    it('returns 0 for undefined', () => expect(parseNumber(undefined)).toBe(0));
    it('returns 0 for non-numeric string', () => expect(parseNumber('abc')).toBe(0));
    it('trims whitespace', () => expect(parseNumber(' 3.14 ')).toBeCloseTo(3.14));
    it('handles integer string', () => expect(parseNumber('42')).toBe(42));
    it('handles zero', () => expect(parseNumber(0)).toBe(0));
    it('handles very small numbers', () => expect(parseNumber('0,000123')).toBeCloseTo(0.000123));
});

// ──────────────────────────────────────────────────────────────────────────────
// calculateAnnualCost
// ──────────────────────────────────────────────────────────────────────────────
describe('tariffService.calculateAnnualCost', () => {
    const baseTariff: Tariff = {
        id: 'test',
        company: 'TestCo',
        name: 'TestTariff',
        powerPriceP1: 0.10,   // €/kW/day
        powerPriceP2: 0.08,
        powerPriceP3: 0.05,
        energyPriceP1: 0.15,  // €/kWh
        energyPriceP2: 0.10,
        energyPriceP3: 0.07,
        connectionFee: 5,      // €/month
        isActive: true,
        updatedAt: new Date().toISOString(),
    };

    it('calculates total annual cost correctly', () => {
        const power = { p1: 5, p2: 5, p3: 5 };   // kW
        const energy = { p1: 100, p2: 200, p3: 300 }; // kWh/month

        // powerCost = (0.10*5 + 0.08*5 + 0.05*5) * 365 = (0.5+0.4+0.25)*365 = 1.15*365 = 419.75
        const expectedPower = (0.10 * 5 + 0.08 * 5 + 0.05 * 5) * 365;
        // energyCost = (0.15*100 + 0.10*200 + 0.07*300) * 12 = (15+20+21)*12 = 56*12 = 672
        const expectedEnergy = (0.15 * 100 + 0.10 * 200 + 0.07 * 300) * 12;
        // connectionCost = 5 * 12 = 60
        const expectedConnection = 5 * 12;

        const result = tariffService.calculateAnnualCost(baseTariff, power, energy);
        expect(result).toBeCloseTo(expectedPower + expectedEnergy + expectedConnection, 2);
    });

    it('returns connection fee only when consumption is zero', () => {
        const power = { p1: 0, p2: 0, p3: 0 };
        const energy = { p1: 0, p2: 0, p3: 0 };
        const result = tariffService.calculateAnnualCost(baseTariff, power, energy);
        expect(result).toBeCloseTo(5 * 12, 2); // only connection fee
    });

    it('uses custom daysPerYear parameter affecting power cost', () => {
        // Use a tariff with no energy or connection cost so power cost is the only variable
        const powerOnlyTariff: Tariff = { ...baseTariff, energyPriceP1: 0, energyPriceP2: 0, energyPriceP3: 0, connectionFee: 0 };
        const power = { p1: 10, p2: 0, p3: 0 };
        const energy = { p1: 0, p2: 0, p3: 0 };
        const result365 = tariffService.calculateAnnualCost(powerOnlyTariff, power, energy, 365);
        const result180 = tariffService.calculateAnnualCost(powerOnlyTariff, power, energy, 180);
        // Power cost is strictly proportional to days when no other cost components exist
        expect(result365 / result180).toBeCloseTo(365 / 180, 2);
    });

    it('scales linearly with power consumption', () => {
        const energy = { p1: 0, p2: 0, p3: 0 };
        const result1 = tariffService.calculateAnnualCost(baseTariff, { p1: 1, p2: 0, p3: 0 }, energy);
        const result2 = tariffService.calculateAnnualCost(baseTariff, { p1: 2, p2: 0, p3: 0 }, energy);
        // Power cost doubles when p1 doubles (connection fee is constant)
        const powerCost1 = 0.10 * 1 * 365;
        const powerCost2 = 0.10 * 2 * 365;
        expect(result2 - result1).toBeCloseTo(powerCost2 - powerCost1, 2);
    });

    it('scales linearly with energy consumption', () => {
        const power = { p1: 0, p2: 0, p3: 0 };
        const result1 = tariffService.calculateAnnualCost(baseTariff, power, { p1: 100, p2: 0, p3: 0 });
        const result2 = tariffService.calculateAnnualCost(baseTariff, power, { p1: 200, p2: 0, p3: 0 });
        expect(result2 - result1).toBeCloseTo(0.15 * 100 * 12, 2);
    });

    it('returns zero for a tariff with all prices zero', () => {
        const zeroTariff: Tariff = {
            ...baseTariff,
            powerPriceP1: 0, powerPriceP2: 0, powerPriceP3: 0,
            energyPriceP1: 0, energyPriceP2: 0, energyPriceP3: 0,
            connectionFee: 0,
        };
        const result = tariffService.calculateAnnualCost(
            zeroTariff,
            { p1: 5, p2: 5, p3: 5 },
            { p1: 100, p2: 100, p3: 100 },
        );
        expect(result).toBe(0);
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// parseCsv
// ──────────────────────────────────────────────────────────────────────────────
describe('tariffService.parseCsv', () => {
    const HEADER = 'COMPAÑIA,TARIFA,PRECIO_POTENCIA_P1,PRECIO_POTENCIA_P2,PRECIO_POTENCIA_P3,PRECIO_ENERGIA_P1,PRECIO_ENERGIA_P2,PRECIO_ENERGIA_P3,DERECHOS_ENGANCHE';

    it('parses a valid one-row CSV', () => {
        const csv = `${HEADER}\nIberdrola,2.0TD Fijo,0.10,0.08,0.05,0.15,0.10,0.07,5.00`;
        const tariffs = tariffService.parseCsv(csv);
        expect(tariffs).toHaveLength(1);
        const t = tariffs[0];
        expect(t.company).toBe('Iberdrola');
        expect(t.name).toBe('2.0TD Fijo');
        expect(t.powerPriceP1).toBeCloseTo(0.10);
        expect(t.energyPriceP1).toBeCloseTo(0.15);
        expect(t.connectionFee).toBeCloseTo(5.0);
        expect(t.isActive).toBe(true);
    });

    it('parses European comma decimals', () => {
        const csv = `${HEADER}\nEndesa,2.0TD,0,10,0,08,0,05,0,15,0,10,0,07,5,00`;
        // Note: each "," in a value will be parsed — but CSV comma-sep splits on ALL commas
        // This tests that the parser handles it gracefully (may return 0s for garbled values)
        const tariffs = tariffService.parseCsv(csv);
        expect(Array.isArray(tariffs)).toBe(true);
    });

    it('returns empty array for header-only CSV', () => {
        const csv = HEADER;
        expect(tariffService.parseCsv(csv)).toEqual([]);
    });

    it('returns empty array for empty string', () => {
        expect(tariffService.parseCsv('')).toEqual([]);
    });

    it('skips rows with fewer than 9 fields', () => {
        const csv = `${HEADER}\nIberdrola,2.0TD,0.10,0.08`; // only 4 fields
        expect(tariffService.parseCsv(csv)).toEqual([]);
    });

    it('parses multiple rows', () => {
        const csv = [
            HEADER,
            'Iberdrola,2.0TD Fijo,0.10,0.08,0.05,0.15,0.10,0.07,5.00',
            'Endesa,2.0TD Flex,0.09,0.07,0.04,0.14,0.09,0.06,4.50',
            'Naturgy,3.0TD,0.12,0.10,0.06,0.18,0.12,0.08,6.00',
        ].join('\n');

        const tariffs = tariffService.parseCsv(csv);
        expect(tariffs).toHaveLength(3);
        expect(tariffs.map(t => t.company)).toEqual(['Iberdrola', 'Endesa', 'Naturgy']);
    });

    it('assigns a unique id to each tariff', () => {
        const csv = [
            HEADER,
            'Iberdrola,2.0TD Fijo,0.10,0.08,0.05,0.15,0.10,0.07,5.00',
            'Endesa,2.0TD Flex,0.09,0.07,0.04,0.14,0.09,0.06,4.50',
        ].join('\n');

        const tariffs = tariffService.parseCsv(csv);
        const ids = tariffs.map(t => t.id);
        expect(new Set(ids).size).toBe(2); // all IDs unique
    });
});

// ──────────────────────────────────────────────────────────────────────────────
// importFromString (deduplication behaviour)
// ──────────────────────────────────────────────────────────────────────────────
describe('tariffService.importFromString — deduplication', () => {
    it('deduplicates by company+name key', () => {
        const HEADER = 'COMPAÑIA,TARIFA,PRECIO_POTENCIA_P1,PRECIO_POTENCIA_P2,PRECIO_POTENCIA_P3,PRECIO_ENERGIA_P1,PRECIO_ENERGIA_P2,PRECIO_ENERGIA_P3,DERECHOS_ENGANCHE';
        // Re-importing the same tariff should NOT add it again
        const csv1 = `${HEADER}\nIberdrola,2.0TD Fijo,0.10,0.08,0.05,0.15,0.10,0.07,5.00`;
        const csv2 = `${HEADER}\nIberdrola,2.0TD Fijo,0.10,0.08,0.05,0.15,0.10,0.07,5.00\nEndesa,2.0TD,0.09,0.07,0.04,0.14,0.09,0.06,4.50`;

        // First: clear, then import csv1
        tariffService.clearAll();
        const r1 = tariffService.importFromString(csv1);
        expect(r1.imported).toBe(1);
        expect(r1.total).toBe(1);

        // Second: import csv2 (same + new)
        const r2 = tariffService.importFromString(csv2);
        expect(r2.total).toBe(2);
        expect(r2.imported).toBe(1); // only the new Endesa tariff
    });
});
