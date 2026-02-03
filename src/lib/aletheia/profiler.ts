import { ClientProfile, InvoiceData, TariffPeriod } from './types';
import { THRESHOLDS } from './config';

export class Profiler {

    static analyze(data: InvoiceData): ClientProfile {
        const tags: string[] = [];
        const salesArguments: string[] = [];

        const totalEnergy = Object.values(data.energy_consumption).reduce((a, b) => a + b, 0);
        if (totalEnergy === 0) {
            return { tags: ['UNKNOWN'], sales_argument: 'No data available.' };
        }

        // --- 1. Weekend Warrior / Night Owl (High P6) ---
        // P6 includes weekends and nights in 2.0TD/3.0TD
        const p6Ratio = (data.energy_consumption.p6 || 0) / totalEnergy;

        if (p6Ratio > THRESHOLDS.P6_NIGHT_OWL) {
            tags.push('WEEKEND_WARRIOR');
            salesArguments.push(`El cliente consume el ${(p6Ratio * 100).toFixed(0)}% de su energía en horario barato (P6). Una tarifa Indexada o con precio valle agresivo es ideal.`);
        }

        // --- 2. Business Hours (High P1+P2) ---
        const p1p2 = (data.energy_consumption.p1 || 0) + (data.energy_consumption.p2 || 0);
        const businessRatio = p1p2 / totalEnergy;

        if (businessRatio > 0.6) {
            tags.push('BUSINESS_HOURS');
            salesArguments.push(`Alta actividad en horario comercial (${(businessRatio * 100).toFixed(0)}%). Priorizar precio fijo en P1/P2 para evitar volatilidad diurna.`);
        }

        // --- 3. Flat Consumer ---
        // If usage is evenly spread (low variance)
        // Simple heuristic: if no period is > 40%
        const maxPeriodShare = Math.max(...Object.values(data.energy_consumption)) / totalEnergy;
        if (maxPeriodShare < 0.35) {
            tags.push('FLAT_PROFILE');
            salesArguments.push('Consumo muy estable. Una tarifa plana o precio fijo simple le daría mucha tranquilidad.');
        }

        // --- 4. High Voltage? (6.1TD) ---
        if (data.tariff_type === '6.1TD') {
            tags.push('HIGH_VOLTAGE');
            salesArguments.push('Cliente industrial de Alta Tensión. Requiere gestión personalizada de excesos de potencia.');
        }

        return {
            tags,
            sales_argument: salesArguments.join(' ') || 'Perfil de consumo estándar. Comparar precio base.'
        };
    }
}
