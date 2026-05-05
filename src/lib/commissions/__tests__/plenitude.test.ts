import { describe, expect, it } from 'vitest';
import { calculatePlenitudeCommission, resolvePlenitudeCommissionGroup } from '../plenitude';

describe('Plenitude commission bands', () => {
    it('maps FACIL PRIME to its dedicated commission group', () => {
        expect(resolvePlenitudeCommissionGroup('3.0TD', 'FACIL', 'PRIME')).toBe('FACIL_PRIME');
    });

    it('calculates a 3.0TD POWER + commission by annual MWh', () => {
        const band = calculatePlenitudeCommission('3.0TD', 'PERIODOS', 'POWER +', 18.5);

        expect(band?.group).toBe('POWER_PLUS_ENERGY_PLUS');
        expect(band?.minMwh).toBe(10);
        expect(band?.maxMwh).toBe(20);
        expect(band?.commissionEur).toBe(406.40);
    });

    it('calculates a 3.0TD FACIL PRIME commission', () => {
        const band = calculatePlenitudeCommission('3.0TD', 'FACIL', 'PRIME', 0.5);

        expect(band?.group).toBe('FACIL_PRIME');
        expect(band?.commissionEur).toBe(138.40);
    });

    it('uses the corrected 6.1TD block for rows 22 to 39', () => {
        const band = calculatePlenitudeCommission('6.1TD', 'FIJO', 'POWER', 18.5);

        expect(band?.tariffType).toBe('6.1TD');
        expect(band?.group).toBe('POWER_ENERGY');
        expect(band?.commissionEur).toBe(163.80);
    });

    it('handles the open-ended > 1200 MWh band', () => {
        const band = calculatePlenitudeCommission('6.1TD', 'FIJO', 'ENERGY +', 1500);

        expect(band?.minMwh).toBe(1200);
        expect(band?.maxMwh).toBeNull();
        expect(band?.commissionEur).toBe(18648.00);
    });
});
