import { describe, it, expect } from 'vitest';
import { Normalizer } from '../normalizer';
import { REE_PROFILES } from '../config';

describe('Normalizer Aletheia', () => {

    describe('cleanFloat', () => {
        it('should handle European format (1.200,50)', () => {
            expect(Normalizer.cleanFloat('1.200,50')).toBe(1200.50);
        });

        it('should handle standard format (1200.50)', () => {
            expect(Normalizer.cleanFloat('1200.50')).toBe(1200.50);
        });

        it('should handle ambiguous dot as thousands (1.200 -> 1200)', () => {
            // Heuristic: If 3 digits after dot, assume thousands in ES context
            expect(Normalizer.cleanFloat('1.200')).toBe(1200);
        });

        it('should handle ambiguous dot as decimal (1.5 -> 1.5)', () => {
            expect(Normalizer.cleanFloat('1.5')).toBe(1.5);
        });

        it('should return 0 for invalid inputs', () => {
            expect(Normalizer.cleanFloat(undefined)).toBe(0);
            expect(Normalizer.cleanFloat('invalid')).toBe(0);
        });
    });

    describe('normalizeToDaily', () => {
        it('should convert annual price to daily', () => {
            expect(Normalizer.normalizeToDaily(365, 'annual')).toBeCloseTo(1, 4);
        });

        it('should convert monthly price to daily', () => {
            expect(Normalizer.normalizeToDaily(30.4167, 'monthly')).toBeCloseTo(1, 4);
        });
    });

    describe('projectAnnualConsumption', () => {
        it('should project January consumption correctly', () => {
            // January Weight from Config
            const janWeight = REE_PROFILES[0];
            const kwh = 100;
            const expected = kwh / janWeight;

            const date = new Date('2024-01-15');
            expect(Normalizer.projectAnnualConsumption(kwh, date)).toBeCloseTo(expected, 2);
        });
    });
});
