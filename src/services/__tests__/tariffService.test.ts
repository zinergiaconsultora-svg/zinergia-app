import { describe, expect, it } from 'vitest';
import { blankCommission, blankTarifa, fmt, fmtEur } from '@/features/tariffs/components/tariff-form-utils';

describe('tariff-form-utils', () => {
    it('formats zero values as an empty dash', () => {
        expect(fmt(0)).toBe('—');
        expect(fmtEur(0)).toBe('—');
    });

    it('formats tariff prices using Spanish numeric conventions', () => {
        expect(fmt(0.1234567, 4)).toBe('0,1235');
        expect(fmtEur(12.5)).toBe('12.50 €');
    });

    it('creates an electricity tariff draft with safe defaults', () => {
        const draft = blankTarifa('electricity');

        expect(draft.supply_type).toBe('electricity');
        expect(draft.tariff_type).toBe('2.0TD');
        expect(draft.tipo_cliente).toBe('PYME');
        expect(draft.offer_type).toBe('fixed');
        expect(draft.is_active).toBe(true);
        expect(draft.consumption_max_kwh).toBeGreaterThan(draft.consumption_min_kwh ?? 0);
    });

    it('creates a gas tariff draft with gas-specific defaults', () => {
        const draft = blankTarifa('gas');

        expect(draft.supply_type).toBe('gas');
        expect(draft.tariff_type).toBe('RL.1');
        expect(draft.fixed_annual_fee_gas).toBe(0);
        expect(draft.variable_price_kwh_gas).toBe(0);
    });

    it('creates a commission draft with broad default applicability', () => {
        const draft = blankCommission();

        expect(draft.supply_type).toBe('electricity');
        expect(draft.tipo_cliente).toBe('PYME');
        expect(draft.producto_tipo).toBe('ELECTRICIDAD_FIJO');
        expect(draft.is_active).toBe(true);
        expect(draft.consumption_max_mwh).toBeGreaterThan(draft.consumption_min_mwh ?? 0);
    });
});
