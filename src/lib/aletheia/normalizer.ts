import { REE_PROFILES } from './config';
import { InvoiceData } from './types';

export class Normalizer {
    /**
     * Sanitizes raw number strings (European format: 1.000,00 -> 1000.00)
     */
    static cleanFloat(val: string | number | undefined): number {
        if (!val) return 0;
        if (typeof val === 'number') return val;

        const str = val.toString().trim();

        // 1. European format check: Contains comma? (e.g. "1.200,50")
        if (str.includes(',')) {
            // Remove dots (thousands), replace comma with dot (decimal)
            const clean = str.replace(/\./g, '').replace(',', '.');
            const num = parseFloat(clean);
            return isNaN(num) ? 0 : num;
        }

        // 2. Standard format or Ambiguous (No comma)
        if (str.includes('.')) {
            const parts = str.split('.');

            // If multiple dots ("1.200.000"), definitely thousands separators
            if (parts.length > 2) {
                const clean = str.replace(/\./g, '');
                return parseFloat(clean) || 0;
            }

            // Exactly one dot ("1200.50" or "1.200")
            const suffix = parts[1];

            // Heuristic: If suffix length is 3 (e.g. .000, .200), assume THOUSANDS in ES context
            // Exception potential: 1.234 kW vs 1234 Watts. 
            // Given Zinergia context (Spain), "1.200" usually means 1200.
            if (suffix.length === 3) {
                const clean = str.replace(/\./g, '');
                return parseFloat(clean) || 0;
            }

            // Otherwise (.5, .50, .12345), assume it's a Standard Float (Decimal Point)
            return parseFloat(str) || 0;
        }

        // Integer string "1200"
        const num = parseFloat(str);
        return isNaN(num) ? 0 : num;
    }

    /**
     * Converts any price frequency (Annual, Monthly) to Daily Price (Unit Trap solution)
     */
    static normalizeToDaily(price: number, type: 'annual' | 'monthly' | 'daily'): number {
        if (type === 'daily') return price;
        if (type === 'monthly') return price / 30.4167; // Standard accounting month
        if (type === 'annual') return price / 365;
        return price;
    }

    /**
     * Projects annual consumption based on a single month's data using REE Profiles
     * @param kwh - The consumption in the invoiced period
     * @param invoiceDate - A date within the invoiced period
     */
    static projectAnnualConsumption(kwh: number, invoiceDate: Date): number {
        const monthIndex = invoiceDate.getMonth(); // 0 = Jan
        const weight = REE_PROFILES[monthIndex] || 0.083; // Fallback to 1/12

        // Formula: Annual = Monthly_Observed / Monthly_Weight
        // Example: 100kWh in Jan (11%) -> 100 / 0.11 = 909 kWh/year
        return kwh / weight;
    }

    /**
     * Main entry point to sanitize incoming invoice data
     */
    /**
     * Main entry point to sanitize incoming invoice data
     * Implements "Pre-processing / Mastication" logic
     */
    static process(raw: any): InvoiceData {
        const warnings: string[] = [];

        // 1. Helper for safe float extraction
        const getVal = (key: string): number => {
            // Handle potential variations or typos in keys if necessary
            return this.cleanFloat(raw[key]);
        };

        // Helper to get from period structure
        const getP = (prefix: string, p: string) => {
            // Try explicit format first (energia_p1) then concatenated (energiap1)
            // Also accept English keys (energy_p1, power_p1) coming from CRM state
            const englishPrefix = prefix === 'energia' ? 'energy' : (prefix === 'potencia' ? 'power' : prefix);

            let val = raw[`${prefix}_${p}`];
            if (val === undefined) val = raw[`${prefix}${p}`];
            if (val === undefined) val = raw[`${englishPrefix}_${p}`]; // Try english e.g. energy_p1
            if (val === undefined) val = raw[`${englishPrefix}${p}`];

            return this.cleanFloat(val);
        };

        // 2. Dates & Days Handling (including 'periodo_facturacion:' typo from legacy OCR)
        let days = this.cleanFloat(raw['periodo_facturacion'] || raw['periodo_facturacion:']); // Handle typo

        let start = new Date(raw.period_start || raw.fecha_inicio);
        let end = new Date(raw.period_end || raw.fecha_fin);

        // Date Fallback Logic (Prevents 'Invalid time value')
        if (isNaN(end.getTime())) {
            end = new Date();
        }
        if (isNaN(start.getTime())) {
            start = new Date(end);
            // If we have the days from OCR, use them, otherwise default to 30
            const diffDays = days > 0 ? days : 30;
            start.setDate(start.getDate() - diffDays);
        }

        // Re-calculate days from dates if OCR was empty or dates are trustworthy
        const calculatedDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 3600 * 24)));
        if (days === 0) days = calculatedDays;

        // 3. Zero Price Anomaly Detection
        // "ALERTA CRÍTICA: Detectado consumo en pX pero precio 0"
        const periods = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
        periods.forEach(p => {
            const energy = getP('energia', p);
            const price = getP('precio_energia', p); // Assuming this field exists in OCR output

            if (energy > 0 && price === 0) {
                // We only warn if price information was expected but found to be 0
                // Note: Some legacy OCR might not map 'precio_energia_pX' at all, so check if key exists in raw?
                // For now, we follow the heuristic: if it's explicitly 0 or missing while having consumption.
                warnings.push(`ALERTA: Detectado consumo en ${p.toUpperCase()} (${energy} kWh) con precio 0. El coste actual puede ser erróneo.`);
            }
        });

        // Cost Mapping with Fallbacks
        let costPower = this.cleanFloat(raw.importe_potencia || raw.power_cost);
        let costEnergy = this.cleanFloat(raw.importe_energia || raw.energy_cost);
        const costReactive = this.cleanFloat(raw.importe_reactiva || raw.reactive_cost);
        const costRental = this.cleanFloat(raw.alquiler_equipos || raw.rental_cost || raw.equipment_cost);
        const subtotal = this.cleanFloat(raw.subtotal_sin_impuestos || raw.subtotal);

        // Fallback: If breakdown is missing but we have subtotal, assign to Energy (heuristic)
        // This ensures "Current Annual Cost" is projected correctly in the Engine
        if (costPower === 0 && costEnergy === 0 && subtotal > 0) {
            costEnergy = subtotal - costReactive - costRental;
            if (costEnergy < 0) costEnergy = subtotal; // Safety
        }

        // Tariff Detection
        let tType: '2.0TD' | '3.0TD' | '6.1TD' = '2.0TD';
        const rawT = (raw.tariff_type || raw.tariff_name || raw.detected_tariff_type || '').toUpperCase();
        if (rawT.includes('3.0') || rawT.includes('3.1')) tType = '3.0TD';
        if (rawT.includes('6.1') || rawT.includes('6.X')) tType = '6.1TD';

        return {
            period_start: start.toISOString(),
            period_end: end.toISOString(),
            days_involced: days,
            tariff_type: tType,
            tariff_determined: rawT || tType, // Meta field
            warnings: warnings, // Pass the warnings to the engine/UI

            contracted_power: {
                p1: getP('potencia', 'p1'),
                p2: getP('potencia', 'p2'),
                p3: getP('potencia', 'p3'),
                p4: getP('potencia', 'p4'),
                p5: getP('potencia', 'p5'),
                p6: getP('potencia', 'p6'),
            },
            max_demand: {
                p1: getP('max_demand', 'p1'),
                p2: getP('max_demand', 'p2'),
                p3: getP('max_demand', 'p3'),
                p4: getP('max_demand', 'p4'),
                p5: getP('max_demand', 'p5'),
                p6: getP('max_demand', 'p6'),
            },
            energy_consumption: {
                p1: getP('energia', 'p1'),
                p2: getP('energia', 'p2'),
                p3: getP('energia', 'p3'),
                p4: getP('energia', 'p4'),
                p5: getP('energia', 'p5'),
                p6: getP('energia', 'p6'),
            },
            current_cost_power: costPower,
            current_cost_energy: costEnergy,
            current_cost_reactive: costReactive,
            current_cost_rental: costRental,
            current_total_tax_excluded: subtotal,
            extra_services: raw.extra_services || []
        };
    }
}
