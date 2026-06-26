/**
 * Detector de anomalías en facturas eléctricas
 * Opera sobre el InvoiceData del CRM (salida del OCR)
 * Sin dependencias externas — función pura, testeable
 */

import { InvoiceData } from '@/types/crm';

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface InvoiceAnomaly {
    id: string;
    severity: AnomalySeverity;
    title: string;
    description: string;
    impact?: string;       // Impacto económico estimado
    context?: string;      // Contexto histórico comparativo (ej: "2.4× mayor que la media")
    action: string;        // Qué debe hacer el agente
}

export interface EnergyHistoryEntry {
    month: string;         // YYYY-MM
    totalEnergy: number;   // kWh
}

// Umbrales de referencia del mercado español (2024-2025)
const THRESHOLDS = {
    // Precio energía: >0.19€/kWh P1 en tarifa fija = caro
    ENERGY_PRICE_P1_HIGH: 0.19,
    // Precio energía: >0.22€/kWh = muy caro (alerta crítica)
    ENERGY_PRICE_P1_CRITICAL: 0.22,
    // Factura mensual alta vs. potencia contratada (€/kW/mes)
    BILL_PER_KW_HIGH: 25,
    // Días de facturación anómalos
    PERIOD_DAYS_MIN: 20,
    PERIOD_DAYS_MAX: 45,
    // Ratio energía/potencia muy bajo = posible potencia sobredimensionada (kWh/kW/mes)
    ENERGY_POWER_RATIO_LOW: 30,
    // Importe sin IVA muy alto relativo al total (indica cargos extra ocultos)
    EXTRA_CHARGES_RATIO: 0.15,
};

function computeHistoricalAvg(history: EnergyHistoryEntry[]): number | null {
    if (!history || history.length < 2) return null;
    const total = history.reduce((sum, e) => sum + e.totalEnergy, 0);
    return total / history.length;
}

function historicalMultiplier(current: number, avg: number): string {
    const ratio = current / avg;
    if (ratio >= 1) return `${ratio.toFixed(1)}× por encima de tu media histórica`;
    return `${(avg / current).toFixed(1)}× por debajo de tu media histórica`;
}

export function detectAnomalies(data: InvoiceData, energyHistory?: EnergyHistoryEntry[]): InvoiceAnomaly[] {
    const anomalies: InvoiceAnomaly[] = [];

    const totalPower = (data.power_p1 || 0) + (data.power_p2 || 0) + (data.power_p3 || 0);
    const totalEnergy = (data.energy_p1 || 0) + (data.energy_p2 || 0) + (data.energy_p3 || 0)
        + (data.energy_p4 || 0) + (data.energy_p5 || 0) + (data.energy_p6 || 0);
    const monthlyBill = data.total_amount || 0;
    const subtotal = data.subtotal || 0;
    const periodDays = data.period_days || 30;

    const historicalAvgEnergy = computeHistoricalAvg(energyHistory ?? []);

    // ─────────────────────────────────────────────
    // 1. PENALIZACIÓN POR ENERGÍA REACTIVA
    // ─────────────────────────────────────────────
    if (data.forensic_details?.reactive_penalty || (data.forensic_details?.energy_reactive && data.forensic_details.energy_reactive > 0)) {
        const reactiveKvarh = data.forensic_details?.energy_reactive || 0;
        anomalies.push({
            id: 'reactive_penalty',
            severity: 'critical',
            title: 'Penalización por energía reactiva',
            description: `La factura incluye cargos por exceso de energía reactiva${reactiveKvarh > 0 ? ` (${reactiveKvarh} kVArh)` : ''}. Indica instalaciones sin compensación de reactiva.`,
            impact: 'Sobrecoste de 150–800€/año según la magnitud',
            action: 'Recomendar instalación de batería de condensadores. ROI típico < 18 meses.',
        });
    }

    // ─────────────────────────────────────────────
    // 2. PRECIO DE ENERGÍA MUY ALTO
    // ─────────────────────────────────────────────
    if (data.current_energy_price_p1 && data.current_energy_price_p1 > THRESHOLDS.ENERGY_PRICE_P1_CRITICAL) {
        const annualOvercost = Math.round((data.current_energy_price_p1 - THRESHOLDS.ENERGY_PRICE_P1_HIGH) * totalEnergy * 12);
        anomalies.push({
            id: 'energy_price_critical',
            severity: 'critical',
            title: 'Precio de energía crítico',
            description: `Paga ${data.current_energy_price_p1.toFixed(4)}€/kWh en P1, muy por encima de la media del mercado (${THRESHOLDS.ENERGY_PRICE_P1_HIGH}€/kWh).`,
            impact: `Sobrecoste estimado de ${annualOvercost}€/año`,
            context: historicalAvgEnergy && totalEnergy > 0
                ? `Consumo de ${totalEnergy.toFixed(0)} kWh este período — ${historicalMultiplier(totalEnergy, historicalAvgEnergy)}. Con este volumen, el sobrecoste acumulado es especialmente significativo.`
                : undefined,
            action: 'Cambio de comercializadora urgente. Potencial ahorro >30%.',
        });
    } else if (data.current_energy_price_p1 && data.current_energy_price_p1 > THRESHOLDS.ENERGY_PRICE_P1_HIGH) {
        anomalies.push({
            id: 'energy_price_high',
            severity: 'warning',
            title: 'Precio de energía superior al mercado',
            description: `Precio P1 de ${data.current_energy_price_p1.toFixed(4)}€/kWh. Existen ofertas más competitivas disponibles.`,
            context: historicalAvgEnergy && totalEnergy > 0
                ? `Consumo de ${totalEnergy.toFixed(0)} kWh · ${historicalMultiplier(totalEnergy, historicalAvgEnergy)}`
                : undefined,
            action: 'Comparar tarifas disponibles en el simulador.',
        });
    }

    // ─────────────────────────────────────────────
    // 3. PERÍODO DE FACTURACIÓN ANÓMALO
    // ─────────────────────────────────────────────
    if (periodDays < THRESHOLDS.PERIOD_DAYS_MIN) {
        const dailyEnergy = totalEnergy > 0 && periodDays > 0 ? (totalEnergy / periodDays).toFixed(1) : null;
        anomalies.push({
            id: 'period_short',
            severity: 'warning',
            title: 'Período de facturación muy corto',
            description: `Solo ${periodDays} días facturados. Puede indicar un cambio de ciclo, error de lectura o factura de corte.`,
            context: dailyEnergy
                ? `Consumo diario implícito: ${dailyEnergy} kWh/día. Normalizado a 30 días equivaldría a ~${Math.round(parseFloat(dailyEnergy) * 30)} kWh.`
                : undefined,
            action: 'Verificar si es una factura de cierre o si el consumo es representativo antes de hacer la comparativa.',
        });
    } else if (periodDays > THRESHOLDS.PERIOD_DAYS_MAX) {
        const dailyEnergy = totalEnergy > 0 && periodDays > 0 ? (totalEnergy / periodDays).toFixed(1) : null;
        anomalies.push({
            id: 'period_long',
            severity: 'warning',
            title: 'Período de facturación muy largo',
            description: `${periodDays} días facturados. Podría incluir consumo de períodos anteriores o estimaciones acumuladas.`,
            context: dailyEnergy
                ? `Consumo diario implícito: ${dailyEnergy} kWh/día. Equivalente mensual: ~${Math.round(parseFloat(dailyEnergy) * 30)} kWh.`
                : undefined,
            action: 'Verificar que el consumo no incluye estimaciones acumuladas antes de hacer la comparativa.',
        });
    }

    // ─────────────────────────────────────────────
    // 4. POTENCIA SOBREDIMENSIONADA
    // ─────────────────────────────────────────────
    if (totalPower > 0 && totalEnergy > 0) {
        // Consumo mensual por kW contratado
        const energyPerKw = totalEnergy / totalPower;
        if (energyPerKw < THRESHOLDS.ENERGY_POWER_RATIO_LOW && totalPower > 5) {
            const excessKw = Math.max(0, totalPower - totalEnergy / THRESHOLDS.ENERGY_POWER_RATIO_LOW);
            const utilizationPct = Math.round((energyPerKw / THRESHOLDS.ENERGY_POWER_RATIO_LOW) * 100);
            const histContext = historicalAvgEnergy
                ? ` Tu media histórica es ${historicalAvgEnergy.toFixed(0)} kWh/mes — el patrón de baja utilización parece consistente.`
                : '';
            anomalies.push({
                id: 'power_oversized',
                severity: 'warning',
                title: 'Potencia contratada sobredimensionada',
                description: `Ratio de ${energyPerKw.toFixed(0)} kWh/kW muy bajo — indica potencia contratada muy superior al uso real.`,
                impact: `Reducción estimada de ${Math.round(excessKw * 0.12 * 365)}€/año`,
                context: `Solo usas el ${utilizationPct}% de la capacidad instalada.${histContext}`,
                action: 'Revisar historial de demanda máxima y proponer reducción de potencia contratada.',
            });
        }
    }

    // ─────────────────────────────────────────────
    // 5. FACTURA MENSUAL ALTA POR KW CONTRATADO
    // ─────────────────────────────────────────────
    if (totalPower > 0 && monthlyBill > 0) {
        const billPerKw = (monthlyBill / (periodDays / 30)) / totalPower;
        if (billPerKw > THRESHOLDS.BILL_PER_KW_HIGH) {
            anomalies.push({
                id: 'high_bill_per_kw',
                severity: 'warning',
                title: 'Importe elevado por kW contratado',
                description: `${billPerKw.toFixed(1)}€/kW/mes, por encima del umbral de referencia (${THRESHOLDS.BILL_PER_KW_HIGH}€/kW/mes).`,
                action: 'Revisar precios de potencia de la tarifa actual. Probable mejora por cambio de oferta.',
            });
        }
    }

    // ─────────────────────────────────────────────
    // 6. CARGOS EXTRA / SERVICIOS OCULTOS
    // ─────────────────────────────────────────────
    if (subtotal > 0 && monthlyBill > 0) {
        const taxAmount = monthlyBill - subtotal;
        const expectedTax = subtotal * 0.21; // IVA 21% estándar
        const excessCharges = taxAmount - expectedTax;
        if (excessCharges > subtotal * THRESHOLDS.EXTRA_CHARGES_RATIO) {
            anomalies.push({
                id: 'extra_charges',
                severity: 'warning',
                title: 'Posibles cargos adicionales detectados',
                description: `La diferencia entre subtotal (${subtotal.toFixed(2)}€) y total (${monthlyBill.toFixed(2)}€) sugiere cargos más allá del IVA estándar.`,
                action: 'Revisar el desglose de la factura original. Pueden existir seguros, mantenimientos o servicios no solicitados.',
            });
        }
    }

    // ─────────────────────────────────────────────
    // 7. TARIFA INDEXADA SIN PROTECCIÓN
    // ─────────────────────────────────────────────
    const tariffName = (data.tariff_name || '').toUpperCase();
    if (
        tariffName.includes('PVPC') ||
        tariffName.includes('INDEXAD') ||
        tariffName.includes('MERCADO')
    ) {
        anomalies.push({
            id: 'indexed_tariff',
            severity: 'info',
            title: 'Tarifa indexada al mercado mayorista',
            description: 'El precio varía cada hora según el mercado OMIE. Alta volatilidad — especialmente cara en picos de demanda.',
            action: 'Evaluar cambio a tarifa fija para mayor previsibilidad de costes.',
        });
    }

    // ─────────────────────────────────────────────
    // 8. DERECHOS DE ENGANCHE ACTIVOS
    // ─────────────────────────────────────────────
    if (data.rights_cost && data.rights_cost > 0) {
        anomalies.push({
            id: 'connection_rights',
            severity: 'info',
            title: 'Derechos de enganche en factura',
            description: `Coste de ${data.rights_cost.toFixed(2)}€ por derechos de acceso/extensión incluido en esta factura.`,
            action: 'Verificar si es un cargo puntual o recurrente. Si es recurrente, escalar con la distribuidora.',
        });
    }

    // ─────────────────────────────────────────────
    // 9. MEMORIA DEL SUMINISTRO (histórico del CUPS)
    // ─────────────────────────────────────────────
    anomalies.push(...detectSupplyMemoryAnomalies(totalEnergy, periodDays, energyHistory ?? []));

    // Ordenar: critical primero, luego warning, luego info
    const order: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 };
    return anomalies.sort((a, b) => order[a.severity] - order[b.severity]);
}

// Umbrales de la memoria del suministro.
const MEMORY = {
    // Fuera de este múltiplo respecto a la media histórica → probable error de OCR.
    OCR_OUTLIER_MULTIPLIER: 3,
    // Salto significativo de consumo respecto a la media (±%).
    CONSUMPTION_JUMP_RATIO: 0.4,
    // Mínimo de meses de histórico para que la señal sea fiable.
    MIN_HISTORY_FOR_JUMP: 2,
    MIN_HISTORY_FOR_OUTLIER: 3,
    MIN_HISTORY_FOR_TREND: 3,
    // Período "normal" (fuera de esto el salto es esperable y no se evalúa).
    PERIOD_NORMAL_MIN: 20,
    PERIOD_NORMAL_MAX: 45,
    // Crecimiento sostenido: último mes ≥ +20% sobre el primero de la ventana.
    TREND_GROWTH_RATIO: 1.2,
};

/**
 * Detecta anomalías comparando la factura actual con el histórico del mismo CUPS.
 * Pura y testeable. La memoria del suministro permite:
 *  - validar la calidad del OCR (lecturas muy fuera del patrón histórico),
 *  - avisar de cambios significativos de consumo,
 *  - señalar tendencias crecientes sostenidas como oportunidad comercial.
 */
export function detectSupplyMemoryAnomalies(
    currentEnergy: number,
    periodDays: number,
    history: EnergyHistoryEntry[],
): InvoiceAnomaly[] {
    const anomalies: InvoiceAnomaly[] = [];
    if (currentEnergy <= 0) return anomalies;

    const avg = computeHistoricalAvg(history);
    const isNormalPeriod = periodDays >= MEMORY.PERIOD_NORMAL_MIN && periodDays <= MEMORY.PERIOD_NORMAL_MAX;

    // 1. Posible error de lectura OCR — consumo muy fuera del patrón histórico.
    if (avg && history.length >= MEMORY.MIN_HISTORY_FOR_OUTLIER) {
        const tooHigh = currentEnergy > avg * MEMORY.OCR_OUTLIER_MULTIPLIER;
        const tooLow = currentEnergy < avg / MEMORY.OCR_OUTLIER_MULTIPLIER;
        if (tooHigh || tooLow) {
            anomalies.push({
                id: 'ocr_consumption_outlier',
                severity: 'critical',
                title: 'Lectura fuera del patrón histórico',
                description: `El consumo extraído (${currentEnergy.toFixed(0)} kWh) está muy lejos de la media de este CUPS (${avg.toFixed(0)} kWh).`,
                context: historicalMultiplier(currentEnergy, avg),
                action: 'Verificar la lectura del OCR en la factura original antes de comparar — posible error de extracción.',
            });
            return anomalies; // Si la lectura es sospechosa, no emitimos el resto de señales de memoria.
        }
    }

    // 2. Salto de consumo significativo (solo en períodos de facturación normales).
    if (avg && isNormalPeriod && history.length >= MEMORY.MIN_HISTORY_FOR_JUMP) {
        const ratio = currentEnergy / avg;
        if (ratio >= 1 + MEMORY.CONSUMPTION_JUMP_RATIO) {
            anomalies.push({
                id: 'consumption_jump_up',
                severity: 'warning',
                title: 'Subida de consumo respecto al histórico',
                description: `El consumo es un ${Math.round((ratio - 1) * 100)}% superior a la media de este suministro.`,
                context: historicalMultiplier(currentEnergy, avg),
                action: 'Confirmar con el cliente si ha cambiado su actividad o si conviene revisar la lectura.',
            });
        } else if (ratio <= 1 - MEMORY.CONSUMPTION_JUMP_RATIO) {
            anomalies.push({
                id: 'consumption_jump_down',
                severity: 'info',
                title: 'Bajada de consumo respecto al histórico',
                description: `El consumo es un ${Math.round((1 - ratio) * 100)}% inferior a la media de este suministro.`,
                context: historicalMultiplier(currentEnergy, avg),
                action: 'Verificar si es una factura de cierre o un cambio real de actividad antes de proyectar el ahorro anual.',
            });
        }
    }

    // 3. Tendencia creciente sostenida (oportunidad).
    if (history.length >= MEMORY.MIN_HISTORY_FOR_TREND) {
        const chronological = [...history].sort((a, b) => a.month.localeCompare(b.month));
        const window = chronological.slice(-3);
        const monotonicUp = window.every((e, i) => i === 0 || e.totalEnergy >= window[i - 1].totalEnergy);
        const first = window[0].totalEnergy;
        const last = window[window.length - 1].totalEnergy;
        if (monotonicUp && first > 0 && last >= first * MEMORY.TREND_GROWTH_RATIO) {
            anomalies.push({
                id: 'consumption_trend_up',
                severity: 'info',
                title: 'Consumo creciente sostenido',
                description: `El consumo ha subido un ${Math.round((last / first - 1) * 100)}% en los últimos ${window.length} períodos registrados.`,
                action: 'Oportunidad: un cliente con consumo creciente gana más con la optimización. Reforzar el argumentario de ahorro.',
            });
        }
    }

    return anomalies;
}

export function getAnomalySummary(anomalies: InvoiceAnomaly[]): {
    total: number;
    critical: number;
    warning: number;
    info: number;
} {
    return {
        total: anomalies.length,
        critical: anomalies.filter(a => a.severity === 'critical').length,
        warning: anomalies.filter(a => a.severity === 'warning').length,
        info: anomalies.filter(a => a.severity === 'info').length,
    };
}
