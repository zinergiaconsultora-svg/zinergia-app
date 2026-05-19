import { describe, expect, it } from 'vitest';
import { getMarketerLogo, normalizeMarketerName } from '../logos';

describe('normalizeMarketerName', () => {
    it('strips underscores and uppercases', () => {
        expect(normalizeMarketerName('GANA_ENERGIA')).toBe('GANAENERGIA');
    });

    it('strips diacritics', () => {
        expect(normalizeMarketerName('Energía')).toBe('ENERGIA');
    });

    it('handles null and undefined', () => {
        expect(normalizeMarketerName(null)).toBe('');
        expect(normalizeMarketerName(undefined)).toBe('');
    });

    it('strips spaces, hyphens, dots', () => {
        expect(normalizeMarketerName('Gana - Energía S.L.')).toBe('GANAENERGIASL');
    });
});

describe('getMarketerLogo', () => {
    it('resolves GANA_ENERGIA from DB', () => {
        expect(getMarketerLogo('GANA_ENERGIA')).toBe('/marketers/gana-energia-tight.jpeg');
    });

    it('resolves LOGOS from DB', () => {
        expect(getMarketerLogo('LOGOS')).toBe('/marketers/logos-energia-light.jpeg');
    });

    it('resolves NATURGY from DB', () => {
        expect(getMarketerLogo('NATURGY')).toBe('/marketers/naturgy.jpeg');
    });

    it('resolves Plenitude (mixed case) from DB', () => {
        expect(getMarketerLogo('Plenitude')).toBe('/marketers/plenitude.jpeg');
    });

    it('returns null for unknown company', () => {
        expect(getMarketerLogo('DESCONOCIDA')).toBeNull();
    });

    it('returns null for null/undefined', () => {
        expect(getMarketerLogo(null)).toBeNull();
        expect(getMarketerLogo(undefined)).toBeNull();
    });

    it('does not fuzzy-match partial names', () => {
        expect(getMarketerLogo('GANAR')).toBeNull();
        expect(getMarketerLogo('NATURGY DISTRIBUCION')).toBeNull();
    });
});
