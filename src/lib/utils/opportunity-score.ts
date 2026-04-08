import { InvoiceData, SavingsResult } from '@/types/crm';

export interface OpportunityScore {
    total: number;        // 0-100
    label: string;        // "Alta" | "Media" | "Baja"
    color: string;        // tailwind color token
    breakdown: {
        savings: number;      // 0-40 — cuánto se puede ahorrar
        tariff: number;       // 0-25 — penalización por tarifa subóptima
        power: number;        // 0-20 — potencia mal calibrada
        periods: number;      // 0-15 — períodos sin consumo pero con potencia
    };
    insights: string[];   // bullets cortos explicando el score
}

/**
 * Calcula un score de oportunidad de ahorro (0-100) para una factura.
 *
 * Puede usarse con resultados ya calculados (post-simulación)
 * o solo con los datos de la factura (pre-simulación, estimación rápida).
 */
export function computeOpportunityScore(
    invoice: InvoiceData,
    results?: SavingsResult[],
): OpportunityScore {
    const insights: string[] = [];
    let savingsScore = 0;
    let tariffScore = 0;
    let powerScore = 0;
    let periodsScore = 0;

    // ── 1. Ahorro potencial (0-40) ────────────────────────────────────────────
    if (results && results.length > 0) {
        const best = results[0];
        const pct = best.savings_percent ?? 0;
        // Escalar: 0% → 0pts, ≥25% → 40pts
        savingsScore = Math.min(40, Math.round((pct / 25) * 40));
        if (pct >= 20) insights.push(`Ahorro potencial del ${pct.toFixed(0)}% — alta oportunidad`);
        else if (pct >= 10) insights.push(`Ahorro del ${pct.toFixed(0)}% — oportunidad media`);
        else if (pct > 0) insights.push(`Ahorro del ${pct.toFixed(0)}% — margen limitado`);
    } else {
        // Sin resultados: estimar por coste bruto (kWh * potencia)
        const totalEnergy = [1,2,3,4,5,6].reduce((s, p) =>
            s + (Number(invoice[`energy_p${p}` as keyof InvoiceData]) || 0), 0);
        const totalPower = [1,2,3,4,5,6].reduce((s, p) =>
            s + (Number(invoice[`power_p${p}` as keyof InvoiceData]) || 0), 0);
        // Heurística: consumo alto + potencia alta = más margen
        if (totalEnergy > 1000 && totalPower > 5) savingsScore = 30;
        else if (totalEnergy > 500) savingsScore = 20;
        else if (totalEnergy > 0) savingsScore = 10;
    }

    // ── 2. Tarifa subóptima (0-25) ────────────────────────────────────────────
    const tariffName = (invoice.tariff_name ?? '').toUpperCase();
    const isFixedTariff = tariffName.includes('FIJA') || tariffName.includes('FIXED');
    const isIndexed    = tariffName.includes('INDEXAD') || tariffName.includes('PVPC') || tariffName.includes('INDEX');
    const totalEnergy  = [1,2,3,4,5,6].reduce((s, p) =>
        s + (Number(invoice[`energy_p${p}` as keyof InvoiceData]) || 0), 0);

    if (isFixedTariff && totalEnergy > 800) {
        tariffScore = 25;
        insights.push('Tarifa fija con consumo alto — una indexada podría ser más barata');
    } else if (!isIndexed && totalEnergy < 300) {
        tariffScore = 15;
        insights.push('Consumo bajo — valorar tarifa simplificada');
    } else if (tariffName === '' || tariffName === 'DESCONOCIDA') {
        tariffScore = 10;
        insights.push('Tarifa no identificada — puede haber alternativas mejores');
    } else {
        tariffScore = 8; // siempre hay algo de margen de comparación
    }

    // ── 3. Potencia mal calibrada (0-20) ─────────────────────────────────────
    const powerP1 = Number(invoice.power_p1 || 0);
    const energyP1 = Number(invoice.energy_p1 || 0);
    const days = Number(invoice.period_days || 30);

    if (powerP1 > 0 && energyP1 > 0 && days > 0) {
        const maxHours = days * 24;
        const utilizationPct = (energyP1 / (powerP1 * maxHours)) * 100;
        if (utilizationPct < 15) {
            powerScore = 20;
            insights.push(`Potencia P1 infra-utilizada (${utilizationPct.toFixed(0)}%) — posible sobrecontratación`);
        } else if (utilizationPct < 30) {
            powerScore = 10;
            insights.push(`Uso del ${utilizationPct.toFixed(0)}% en P1 — revisar potencia contratada`);
        } else {
            powerScore = 4;
        }
    }

    // ── 4. Períodos vacíos con potencia (0-15) ────────────────────────────────
    let emptyWithPower = 0;
    for (let p = 2; p <= 6; p++) {
        const e = Number(invoice[`energy_p${p}` as keyof InvoiceData] || 0);
        const pw = Number(invoice[`power_p${p}` as keyof InvoiceData] || 0);
        if (e === 0 && pw > 0) emptyWithPower++;
    }
    if (emptyWithPower >= 3) {
        periodsScore = 15;
        insights.push(`${emptyWithPower} períodos sin consumo pero con potencia contratada`);
    } else if (emptyWithPower >= 1) {
        periodsScore = 8;
        insights.push(`${emptyWithPower} período(s) con potencia no usada`);
    }

    const total = Math.min(100, savingsScore + tariffScore + powerScore + periodsScore);

    let label: string;
    let color: string;
    if (total >= 65) { label = 'Alta'; color = 'emerald'; }
    else if (total >= 35) { label = 'Media'; color = 'amber'; }
    else { label = 'Baja'; color = 'slate'; }

    if (insights.length === 0) insights.push('Factura estable — poca optimización aparente');

    return {
        total,
        label,
        color,
        breakdown: { savings: savingsScore, tariff: tariffScore, power: powerScore, periods: periodsScore },
        insights,
    };
}
