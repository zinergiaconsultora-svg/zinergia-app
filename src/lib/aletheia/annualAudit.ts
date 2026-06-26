import type { AnnualConsolidatedProfile } from './annualConsolidation';

// ─── Types ────────────────────────────────────────────────────────────────────

export type FindingSeverity = 'critical' | 'high' | 'medium' | 'info';
export type FindingCategory = 'potencia' | 'reactiva' | 'tarifa' | 'facturacion' | 'estacional' | 'precio';

export interface AuditFinding {
    id: string;
    category: FindingCategory;
    severity: FindingSeverity;
    title: string;
    description: string;
    annualSavingsEur: number;     // 0 if not quantifiable
    actionLabel: string;          // Short CTA for the agent
    actionDetail: string;         // Full explanation
    confidence: 'alta' | 'media' | 'baja';
    supportingData?: Record<string, string | number>; // key data points to show
}

export interface AnnualAuditResult {
    findings: AuditFinding[];
    totalQuantifiedSavings: number;
    topPriority: AuditFinding | null;
    hasActionablePowerOptimization: boolean;
    hasRecurringReactive: boolean;
    powerOptimizationByPeriod: PowerOptimizationPeriod[] | null;
}

export interface PowerOptimizationPeriod {
    period: string;       // 'P1', 'P2', ...
    contracted: number;   // kW
    realPeak: number;     // kW (from maxímetro, or estimated)
    optimal: number;      // kW recommended
    savingsEur: number;   // saving from reducing this period
    isFromMaximeter: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

// Power price approximation for savings estimation when we don't have exact tariff
// Uses average market rates for 3.0TD; overridden by actual prices if available
const APPROX_POWER_PRICE: Record<string, number> = {
    p1: 0.0567, p2: 0.0339, p3: 0.0225, p4: 0.0225, p5: 0.0225, p6: 0.0148,
};

// Reactive energy compensation price (€/kVARh) — regulated
const REACTIVE_PRICE_EUR_KVARH = 0.041624;

// Safety margin for power reduction recommendation (85/105 rule buffer)
const POWER_SAFETY_MARGIN = 1.05;

// ─── Main audit function ───────────────────────────────────────────────────────

export function auditAnnualProfile(profile: AnnualConsolidatedProfile): AnnualAuditResult {
    const findings: AuditFinding[] = [];

    // 1. Power optimization via maxímetro
    const powerResult = auditPowerOptimization(profile);
    if (powerResult.finding) findings.push(powerResult.finding);

    // 2. Reactive energy — recurrent penalty
    const reactiveResult = auditReactiveEnergy(profile);
    if (reactiveResult) findings.push(reactiveResult);

    // 3. Tariff strategy vs consumption curve
    const tariffResult = auditTariffStrategy(profile);
    if (tariffResult) findings.push(tariffResult);

    // 4. Invoice anomalies — price variation across months
    const anomalyResult = auditInvoiceAnomalies(profile);
    if (anomalyResult) findings.push(anomalyResult);

    // 5. Seasonal guidance — what's missing for a full picture
    const seasonalResult = auditSeasonalCoverage(profile);
    if (seasonalResult) findings.push(seasonalResult);

    // 6. Price/kWh evolution — rising or falling trend over the covered period
    const priceResult = auditPriceEvolution(profile);
    if (priceResult) findings.push(priceResult);

    // Sort by: severity first, then savings
    const sortOrder: Record<FindingSeverity, number> = {
        critical: 0, high: 1, medium: 2, info: 3,
    };
    findings.sort((a, b) => {
        const diff = sortOrder[a.severity] - sortOrder[b.severity];
        return diff !== 0 ? diff : b.annualSavingsEur - a.annualSavingsEur;
    });

    const totalQuantifiedSavings = findings.reduce((s, f) => s + f.annualSavingsEur, 0);
    const topPriority = findings.find(f => f.annualSavingsEur > 0) ?? findings[0] ?? null;

    return {
        findings,
        totalQuantifiedSavings,
        topPriority,
        hasActionablePowerOptimization: powerResult.hasAction,
        hasRecurringReactive: profile.reactiveRecurrent,
        powerOptimizationByPeriod: powerResult.byPeriod,
    };
}

// ─── Finding: Power optimization ─────────────────────────────────────────────

function auditPowerOptimization(profile: AnnualConsolidatedProfile): {
    finding: AuditFinding | null;
    hasAction: boolean;
    byPeriod: PowerOptimizationPeriod[] | null;
} {
    const periods = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'] as const;
    const byPeriod: PowerOptimizationPeriod[] = [];
    let totalSavings = 0;

    for (const p of periods) {
        const contracted = profile.contractedPowerByPeriod[p];
        if (contracted <= 0) continue;

        const realPeak = profile.peakDemandByPeriod[p];
        const isFromMaximeter = profile.hasMaximeterData;

        // Optimal: real peak × safety margin (min 1.0 kW above peak)
        const optimal = Math.max(realPeak * POWER_SAFETY_MARGIN, realPeak + 1.0);

        // Only recommend reduction if contracted > optimal by meaningful margin (>5%)
        const margin = (contracted - optimal) / contracted;
        if (margin < 0.08) continue;

        const reduction = contracted - optimal;
        const pricePerKw = APPROX_POWER_PRICE[p] ?? 0.03;
        const savings = reduction * pricePerKw * 365;

        byPeriod.push({
            period: p.toUpperCase(),
            contracted,
            realPeak,
            optimal: Math.round(optimal * 10) / 10,
            savingsEur: Math.round(savings),
            isFromMaximeter,
        });
        totalSavings += savings;
    }

    if (byPeriod.length === 0) {
        return { finding: null, hasAction: false, byPeriod: null };
    }

    const topPeriod = byPeriod.sort((a, b) => b.savingsEur - a.savingsEur)[0];
    const confidence = profile.hasMaximeterData
        ? (profile.monthsCovered >= 4 ? 'alta' : 'media')
        : 'baja';

    return {
        finding: {
            id: 'power-optimization',
            category: 'potencia',
            severity: totalSavings > 200 ? 'high' : 'medium',
            title: 'Potencia sobrecontratada',
            description: `${byPeriod.length} periodo${byPeriod.length > 1 ? 's' : ''} con margen de reducción. El pico real anual en ${topPeriod.period} es ${topPeriod.realPeak.toFixed(1)} kW pero contratas ${topPeriod.contracted.toFixed(1)} kW.`,
            annualSavingsEur: Math.round(totalSavings),
            actionLabel: `Bajar potencia a ${topPeriod.optimal} kW en ${topPeriod.period}`,
            actionDetail: `Reducir la potencia contratada a los niveles óptimos (pico real × ${(POWER_SAFETY_MARGIN * 100).toFixed(0)}% de margen) eliminaría ${Math.round(totalSavings)} €/año en término fijo, sin riesgo de penalización por exceso de demanda.`,
            confidence,
            supportingData: {
                'Periodos afectados': byPeriod.length,
                'Mayor ahorro': `${topPeriod.period}: ${topPeriod.contracted.toFixed(1)} → ${topPeriod.optimal} kW`,
                'Fuente': profile.hasMaximeterData ? 'Maxímetro real' : 'Potencia contratada',
                'Facturas analizadas': profile.monthsCovered,
            },
        },
        hasAction: true,
        byPeriod,
    };
}

// ─── Finding: Reactive energy ─────────────────────────────────────────────────

function auditReactiveEnergy(profile: AnnualConsolidatedProfile): AuditFinding | null {
    if (!profile.reactiveRecurrent && profile.annualReactiveCost < 30) return null;

    const monthsWithReactive = profile.months.filter(m => m.hasReactivePenalty).length;
    const annualCost = Math.round(profile.annualReactiveCost);

    // ROI estimate for capacitor bank: typical cost 800-1500€ depending on kVAR
    // Simple estimate: ROI = investment / annual_saving
    const estimatedInvestment = Math.max(800, annualCost * 3);
    const roiMonths = Math.round((estimatedInvestment / annualCost) * 12);

    return {
        id: 'reactive-energy',
        category: 'reactiva',
        severity: profile.reactiveRecurrent ? 'high' : 'medium',
        title: 'Penalización por energía reactiva',
        description: `Aparece en ${monthsWithReactive} de ${profile.monthsCovered} facturas analizadas. Coste anual estimado: ${annualCost} €.`,
        annualSavingsEur: annualCost,
        actionLabel: 'Instalar batería de condensadores',
        actionDetail: `La energía reactiva es un coste evitable al 100% con una batería de condensadores. Inversión estimada ${estimatedInvestment}–${estimatedInvestment * 1.5} €, ROI a ${roiMonths} meses. Facturable directamente al cliente como servicio adicional.`,
        confidence: profile.reactiveRecurrent ? 'alta' : 'media',
        supportingData: {
            'Meses con penalización': `${monthsWithReactive}/${profile.monthsCovered}`,
            'Coste anual': `${annualCost} €`,
            'ROI batería condensadores': `${roiMonths} meses`,
        },
    };
}

// ─── Finding: Tariff strategy ─────────────────────────────────────────────────

function auditTariffStrategy(profile: AnnualConsolidatedProfile): AuditFinding | null {
    if (profile.monthsCovered < 2) return null;

    const { seasonalRatio, energyByPeriod, totalEnergyKwh } = profile;
    if (totalEnergyKwh <= 0) return null;

    const p1Pct = ((energyByPeriod.p1 ?? 0) / totalEnergyKwh) * 100;
    const valleyPct = ((energyByPeriod.p6 ?? 0) / totalEnergyKwh) * 100;

    // High valley consumption → indexed or discrimination tariff
    if (valleyPct > 40) {
        return {
            id: 'tariff-valley',
            category: 'tarifa',
            severity: 'medium',
            title: 'Perfil nocturno: discriminación horaria o indexado',
            description: `El ${valleyPct.toFixed(0)}% del consumo anual cae en horas valle (P6). Con una tarifa de discriminación o indexada al OMIE, ese consumo pagaría significativamente menos.`,
            annualSavingsEur: 0,
            actionLabel: 'Evaluar indexado o discriminación 2.0DHA',
            actionDetail: `Un cliente con ${valleyPct.toFixed(0)}% de consumo en valle tiene margen real de ahorro con tarifas nocturnas. La diferencia P1-P6 en indexado puede ser del 30-50% en horas OMIE favorables.`,
            confidence: profile.monthsCovered >= 4 ? 'alta' : 'media',
            supportingData: {
                '% consumo en valle (P6)': `${valleyPct.toFixed(1)}%`,
                '% consumo en punta (P1)': `${p1Pct.toFixed(1)}%`,
                'Facturas analizadas': profile.monthsCovered,
            },
        };
    }

    // High peak consumption + high seasonality → fixed tariff
    if (p1Pct > 50 && seasonalRatio.ratio > 1.5) {
        return {
            id: 'tariff-fixed',
            category: 'tarifa',
            severity: 'medium',
            title: 'Consumo picudo y estacional: tarifa fija recomendada',
            description: `El ${p1Pct.toFixed(0)}% del consumo es en horas punta con una estacionalidad ${seasonalRatio.ratio.toFixed(1)}x. Una tarifa fija da previsibilidad y evita picos de coste en ${seasonalRatio.peakSeason}.`,
            annualSavingsEur: 0,
            actionLabel: 'Recomendar tarifa fija con precio punta competitivo',
            actionDetail: `Alta concentración en P1 + picos estacionales en ${seasonalRatio.peakSeason} hacen que el indexado sea arriesgado. Una tarifa fija bien negociada protege contra volatilidad del mercado mayorista.`,
            confidence: 'media',
            supportingData: {
                '% consumo en punta (P1)': `${p1Pct.toFixed(1)}%`,
                'Ratio estacional': `${seasonalRatio.ratio.toFixed(1)}x`,
                'Temporada pico': seasonalRatio.peakSeason,
            },
        };
    }

    return null;
}

// ─── Finding: Invoice anomalies ───────────────────────────────────────────────

function auditInvoiceAnomalies(profile: AnnualConsolidatedProfile): AuditFinding | null {
    if (profile.monthsCovered < 3) return null;

    const amounts = profile.months.map(m => m.totalAmount).filter(a => a > 0);
    if (amounts.length < 3) return null;

    // Normalize amount per day to make periods comparable
    const perDay = profile.months
        .filter(m => m.totalAmount > 0 && m.periodDays > 0)
        .map(m => ({ month: m.month, perDay: m.totalAmount / m.periodDays }));

    if (perDay.length < 3) return null;

    const vals = perDay.map(p => p.perDay);
    const mean = vals.reduce((s, v) => s + v, 0) / vals.length;
    const stddev = Math.sqrt(vals.map(v => (v - mean) ** 2).reduce((s, v) => s + v, 0) / vals.length);

    // Flag months that deviate more than 2 sigma
    const outliers = perDay.filter(p => Math.abs(p.perDay - mean) > 2 * stddev);
    if (outliers.length === 0) return null;

    const worstOutlier = outliers.sort((a, b) => Math.abs(b.perDay - mean) - Math.abs(a.perDay - mean))[0];
    const deviationPct = Math.round(((worstOutlier.perDay - mean) / mean) * 100);
    const estimatedError = Math.abs(worstOutlier.perDay - mean) * 30; // approx 30-day impact

    return {
        id: 'invoice-anomaly',
        category: 'facturacion',
        severity: 'high',
        title: `Anomalía de facturación detectada`,
        description: `La factura de ${formatMonth(worstOutlier.month)} tiene un coste/día ${Math.abs(deviationPct)}% ${deviationPct > 0 ? 'superior' : 'inferior'} a la media. Posible error de facturación, lectura estimada o cambio de tarifa sin notificar.`,
        annualSavingsEur: deviationPct > 0 ? Math.round(estimatedError) : 0,
        actionLabel: 'Revisar y reclamar factura',
        actionDetail: `La factura del mes ${formatMonth(worstOutlier.month)} supone ${Math.abs(deviationPct)}% de desviación respecto a la media del periodo. Revisar si la lectura fue real o estimada, comparar con el precio del mercado de ese mes y reclamar si procede.`,
        confidence: profile.monthsCovered >= 4 ? 'alta' : 'media',
        supportingData: {
            'Mes anómalo': formatMonth(worstOutlier.month),
            'Desviación': `${deviationPct > 0 ? '+' : ''}${deviationPct}%`,
            'Importe potencialmente reclamable': `~${Math.round(estimatedError)} €`,
        },
    };
}

// ─── Finding: Seasonal coverage gap ───────────────────────────────────────────

function auditSeasonalCoverage(profile: AnnualConsolidatedProfile): AuditFinding | null {
    if (profile.missingSeasons.length === 0 || profile.monthsCovered >= 4) return null;

    const missing = profile.missingSeasons.join(', ');
    const isHighRisk = profile.missingSeasons.includes('verano') || profile.missingSeasons.includes('invierno');

    return {
        id: 'seasonal-gap',
        category: 'estacional',
        severity: isHighRisk ? 'medium' : 'info',
        title: 'Análisis incompleto — faltan estaciones',
        description: `No hay datos de: ${missing}. ${isHighRisk ? 'Verano e invierno suelen ser los picos de consumo más importantes.' : ''}`,
        annualSavingsEur: 0,
        actionLabel: `Pedir al cliente facturas de ${missing}`,
        actionDetail: `Tener datos de las 4 estaciones permite calcular la potencia óptima con seguridad total, afinar la estrategia fijo/indexado y detectar picos de consumo ocultos. Con ${profile.monthsCovered} ${profile.monthsCovered === 1 ? 'factura' : 'facturas'} el análisis está en nivel "${profile.confidenceLevel}".`,
        confidence: 'alta',
        supportingData: {
            'Estaciones cubiertas': `${4 - profile.missingSeasons.length}/4`,
            'Estaciones pendientes': missing,
            'Nivel de análisis actual': profile.confidenceLevel,
        },
    };
}

// ─── Finding: Price/kWh evolution ─────────────────────────────────────────────

function auditPriceEvolution(profile: AnnualConsolidatedProfile): AuditFinding | null {
    if (profile.monthsCovered < 3) return null;

    const priceData = profile.months
        .filter(m => m.totalEnergy > 0 && m.totalAmount > 0)
        .map(m => ({ month: m.month, pricePerKwh: m.totalAmount / m.totalEnergy }))
        .sort((a, b) => a.month.localeCompare(b.month));

    if (priceData.length < 3) return null;

    const mid = Math.floor(priceData.length / 2);
    const avgFirst = priceData.slice(0, mid).reduce((s, p) => s + p.pricePerKwh, 0) / mid;
    const avgRecent = priceData.slice(mid).reduce((s, p) => s + p.pricePerKwh, 0) / (priceData.length - mid);

    const trendPct = ((avgRecent - avgFirst) / avgFirst) * 100;
    if (Math.abs(trendPct) < 10) return null;

    const isRising = trendPct > 0;
    const annualImpact = Math.abs(Math.round((avgRecent - avgFirst) * profile.totalEnergyKwh));

    return {
        id: 'price-evolution',
        category: 'precio',
        severity: Math.abs(trendPct) > 25 ? 'high' : 'medium',
        title: `Precio/kWh ${isRising ? 'en alza' : 'a la baja'}: ${isRising ? '+' : ''}${trendPct.toFixed(0)}%`,
        description: `El coste medio por kWh ha ${isRising ? 'subido' : 'bajado'} de ${(avgFirst * 100).toFixed(1)} a ${(avgRecent * 100).toFixed(1)} cts/kWh en el periodo. A consumo constante supone ${annualImpact} €/año ${isRising ? 'adicionales' : 'de ahorro'}.`,
        annualSavingsEur: isRising ? annualImpact : 0,
        actionLabel: isRising
            ? 'Renegociar precio o cambiar a tarifa indexada'
            : 'Evolución favorable — confirmar origen del descenso',
        actionDetail: isRising
            ? `El precio/kWh lleva ${profile.monthsCovered} meses encareciéndose. Si la tendencia continúa, el cliente perderá poder adquisitivo sin cambiar nada. Revisar si la tarifa actual tiene precio fijo protegido o si está expuesta al mercado. Valorar indexado OMIE si el perfil de consumo es favorable.`
            : `El precio/kWh ha mejorado — posiblemente por renegociación, cambio de tarifa o mercado más barato. Confirmar con el cliente el motivo y asegurarse de que la mejora se mantiene en el contrato actual.`,
        confidence: profile.monthsCovered >= 4 ? 'alta' : 'media',
        supportingData: {
            'Precio inicial (media)': `${(avgFirst * 100).toFixed(1)} cts/kWh`,
            'Precio reciente (media)': `${(avgRecent * 100).toFixed(1)} cts/kWh`,
            'Variación': `${isRising ? '+' : ''}${trendPct.toFixed(0)}%`,
            'Impacto anual estimado': `${isRising ? '+' : '-'}${annualImpact} €`,
        },
    };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonth(ym: string): string {
    const [year, month] = ym.split('-');
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${months[parseInt(month, 10) - 1]} ${year}`;
}
