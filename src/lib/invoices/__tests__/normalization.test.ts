import { describe, expect, it } from 'vitest';
import {
    getVisibleInvoicePeriods,
    inferInvoicePowerType,
    normalizeInvoiceData,
} from '../normalization';

const novaluzText = `
TÉRMINO POTENCIA TARIFA
P1 22,000 kW x 31 Días x 0,05582720 €/kW día 38,07 €
P2 22,000 kW x 31 Días x 0,02908937 €/kW día 19,84 €
P3 22,000 kW x 31 Días x 0,01227817 €/kW día 8,37 €
P4 22,000 kW x 31 Días x 0,01064749 €/kW día 7,26 €
P5 22,000 kW x 31 Días x 0,00688726 €/kW día 4,70 €
P6 22,000 kW x 31 Días x 0,00395147 €/kW día 2,69 €
TÉRMINO ENERGÍA
P2 302 kWh x 0,226424 €/kWh 68,38 €
P3 373 kWh x 0,200080 €/kWh 74,63 €
P6 846 kWh x 0,169704 €/kWh 143,57 €
AUTOCONSUMO
P2 858 kWh x 0,007529 €/kWh -6,46 €
P3 918 kWh x 0,009264 €/kWh -8,50 €
P6 1107 kWh x 0,004783 €/kWh -5,29 €
LECTURAS
P6 855
POTENCIAS MÁXIMAS DEMANDADAS (kW)
P6: 23,892
`;

describe('invoice normalization', () => {
    it('recovers P1-P6 power and billed P6 energy from invoice text blocks', () => {
        const result = normalizeInvoiceData({
            period_days: 30,
            detected_power_type: '2.0',
            tariff_name: '2.0TD',
            power_p1: 22,
            power_p2: 22,
            power_p3: 0,
            power_p4: 0,
            power_p5: 0,
            power_p6: 0,
            energy_p1: 0,
            energy_p2: 302,
            energy_p3: 373,
            energy_p4: 0,
            energy_p5: 0,
            energy_p6: 0,
        }, { rawText: novaluzText });

        expect(result.invoice.period_days).toBe(31);
        expect(result.invoice.detected_power_type).toBe('3.0');
        expect(result.invoice.power_p1).toBe(22);
        expect(result.invoice.power_p6).toBe(22);
        expect(result.invoice.energy_p2).toBe(302);
        expect(result.invoice.energy_p3).toBe(373);
        expect(result.invoice.energy_p6).toBe(846);
        expect(result.invoice.current_power_price_p6).toBeCloseTo(0.00395147, 8);
        expect(result.invoice.current_energy_price_p6).toBeCloseTo(0.169704, 6);
        expect(result.invoice.energy_p6).not.toBe(855);
        expect(result.invoice.energy_p6).not.toBe(1107);
    });

    it('does not let a contradictory 2.0 hint hide P4-P6 data', () => {
        const invoice = {
            detected_power_type: '2.0',
            tariff_name: '2.0TD',
            period_days: 31,
            power_p1: 22,
            power_p2: 22,
            power_p3: 22,
            power_p4: 22,
            power_p5: 22,
            power_p6: 22,
            energy_p1: 0,
            energy_p2: 302,
            energy_p3: 373,
            energy_p4: 0,
            energy_p5: 0,
            energy_p6: 846,
        };

        expect(inferInvoicePowerType(invoice)).toBe('3.0');
        expect(getVisibleInvoicePeriods(invoice, '2.0')).toEqual({
            energy: [1, 2, 3, 6],
            power: [1, 2, 3, 4, 5, 6],
        });
    });

    it('extracts special invoice concepts needed for supervised comparisons', () => {
        const result = normalizeInvoiceData({
            period_days: 31,
            detected_power_type: '3.0',
            tariff_name: '3.0TD',
            power_p1: 22,
            power_p2: 22,
            power_p3: 22,
            power_p4: 22,
            power_p5: 22,
            power_p6: 22,
            energy_p1: 0,
            energy_p2: 302,
            energy_p3: 373,
            energy_p4: 0,
            energy_p5: 0,
            energy_p6: 846,
        }, {
            rawText: `
Financiación bono social fijo 0,59 €
Término de exceso de potencia distribuidora 3,23 €
Energía reactiva facturada 24,70 €
Alquiler equipos de medida 1,39 €
Servicio GoClean 8,05 €
Descuento GoClean -3,00 €
Impuesto sobre la electricidad 5,11269632% 19,02 €
IVA 21% 75,43 €
Consumo acumulado último año 11.229 kWh
AUTOCONSUMO
P2 858 kWh x 0,007529 €/kWh -6,46 €
P3 918 kWh x 0,009264 €/kWh -8,50 €
P6 1107 kWh x 0,004783 €/kWh -5,29 €
LECTURAS
`,
        });

        expect(result.invoice.bono_social).toBeCloseTo(0.59, 2);
        expect(result.invoice.distribution_excess_cost).toBeCloseTo(3.23, 2);
        expect(result.invoice.reactive_energy_cost).toBeCloseTo(24.70, 2);
        expect(result.invoice.rental_cost).toBeCloseTo(1.39, 2);
        expect(result.invoice.excluded_services_cost).toBeCloseTo(5.05, 2);
        expect(result.invoice.surplus_export_kwh).toBe(2883);
        expect(result.invoice.annual_consumption_kwh).toBe(11229);
        expect(result.invoice.electricity_tax_percent).toBeCloseTo(5.11269632, 8);
        expect(result.invoice.vat_percent).toBe(21);
    });
});
