import { describe, it, expect } from 'vitest';
import { resolveTitularDniCif, isValidSpanishTaxId, isNonTitularCif } from '../titularId';

describe('isValidSpanishTaxId', () => {
    it('accepts DNI, NIE and CIF', () => {
        expect(isValidSpanishTaxId('07018279J')).toBe(true);   // DNI
        expect(isValidSpanishTaxId('X1234567L')).toBe(true);   // NIE
        expect(isValidSpanishTaxId('B12345678')).toBe(true);   // CIF
        expect(isValidSpanishTaxId('A-95758389')).toBe(true);  // CIF con guion (se normaliza)
    });
    it('rejects junk', () => {
        expect(isValidSpanishTaxId('ES123')).toBe(false);
        expect(isValidSpanishTaxId('')).toBe(false);
    });
});

describe('isNonTitularCif', () => {
    it('flags the marketer CIF (Iberdrola) regardless of formatting', () => {
        expect(isNonTitularCif('A-95758389')).toBe(true);
        expect(isNonTitularCif('a95758389')).toBe(true);
        expect(isNonTitularCif('07018279J')).toBe(false);
    });
});

describe('resolveTitularDniCif', () => {
    it('returns the holder DNI from a generic field', () => {
        expect(resolveTitularDniCif({ dni_cif: '07018279J' })).toBe('07018279J');
    });

    it('rejects the marketer CIF when it is the only value', () => {
        // Mejor vacío que el CIF equivocado — el gate de campos obligatorios lo pedirá.
        expect(resolveTitularDniCif({ dni_cif: 'A-95758389' })).toBe('');
    });

    it('picks the holder DNI over the marketer CIF (real Iberdrola invoice)', () => {
        expect(resolveTitularDniCif({ CIF: 'A95758389', DNI: '07018279J' })).toBe('07018279J');
    });

    it('prefers an explicitly-labelled titular field', () => {
        expect(resolveTitularDniCif({ dni_cif: 'A95758389', nif_titular: '07018279J' })).toBe('07018279J');
    });

    it('keeps a PYME holder CIF while excluding a flagged comercializadora CIF', () => {
        expect(resolveTitularDniCif({ company_cif: 'A95758389', dni_cif: 'B12345678' })).toBe('B12345678');
    });

    it('returns empty when nothing usable is present', () => {
        expect(resolveTitularDniCif({ company_name: 'IBERDROLA' })).toBe('');
    });
});
