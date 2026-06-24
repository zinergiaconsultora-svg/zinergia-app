import { describe, it, expect } from 'vitest';
import { conversionRate } from '../metrics';

describe('conversionRate', () => {
    it('computes won / (won + lost) as a rounded percentage', () => {
        expect(conversionRate(3, 1)).toBe(75);
        expect(conversionRate(1, 1)).toBe(50);
        expect(conversionRate(2, 1)).toBe(67);
    });
    it('returns 0 when there are no closed leads', () => {
        expect(conversionRate(0, 0)).toBe(0);
    });
    it('returns 100 when none were lost', () => {
        expect(conversionRate(5, 0)).toBe(100);
    });
});
