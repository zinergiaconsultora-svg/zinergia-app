import { describe, expect, it } from 'vitest';
import {
    buildSipsUrl,
    calculateElectricityAnnualConsumption,
    isValidCups,
    normalizeCups,
    parseCsv,
} from '../sips';

describe('CNMC SIPS helpers', () => {
    it('normalizes and validates CUPS values', () => {
        expect(normalizeCups(' es0021000000000000aa1f ')).toBe('ES0021000000000000AA1F');
        expect(isValidCups('ES0021000000000000AA1F')).toBe(true);
        expect(isValidCups('bad-cups')).toBe(false);
    });

    it('builds the CNMC individual query URL for electricity consumptions', () => {
        expect(buildSipsUrl('SIPS2_CONSUMOS_ELECTRICIDAD', 'ES0021000000000000AA1F')).toBe(
            'https://api.cnmc.gob.es/verticales/v1/SIPS/consulta/v1/SIPS2_CONSUMOS_ELECTRICIDAD.csv?cups=ES0021000000000000AA1F',
        );
    });

    it('parses semicolon CSV responses', () => {
        const rows = parseCsv([
            'cups;consumoEnergiaActivaEnWhP1;consumoEnergiaActivaEnWhP2',
            'ES0021000000000000AA1F;1000;2.000',
        ].join('\n'));

        expect(rows).toEqual([
            {
                cups: 'ES0021000000000000AA1F',
                consumoEnergiaActivaEnWhP1: '1000',
                consumoEnergiaActivaEnWhP2: '2.000',
            },
        ]);
    });

    it('sums active energy P1-P6 in Wh and converts it to kWh and MWh', () => {
        const csv = [
            'cups;consumoEnergiaActivaEnWhP1;consumoEnergiaActivaEnWhP2;consumoEnergiaActivaEnWhP3;consumoEnergiaActivaEnWhP4;consumoEnergiaActivaEnWhP5;consumoEnergiaActivaEnWhP6',
            'ES0021000000000000AA1F;1000000;2000000;3000000;4000000;5000000;6000000',
            'ES0021000000000000AA1F;500000;500000;500000;500000;500000;500000',
        ].join('\n');

        const result = calculateElectricityAnnualConsumption('ES0021000000000000AA1F', csv);

        expect(result.rows).toBe(2);
        expect(result.annualKwh).toBe(24000);
        expect(result.annualMwh).toBe(24);
    });
});
