import {
    type ConversionMemory,
    getConversionSignal,
    conversionDelta,
} from './conversionMemory';

export type SupervisedRecommendationKind = 'max_savings' | 'balanced' | 'best_viable_commission';
export type RecommendationConfidence = 'high' | 'medium' | 'low';

export interface SupervisedCandidate {
    id: string;
    tariffName: string;
    company: string;
    annualSavings: number;
    annualCost: number;
    estimatedAgentCommission?: number | null;
    criticalAlerts?: number;
    warningAlerts?: number;
    hasMissingCommission?: boolean;
    /** Tipo de oferta — usado para cruzar con la memoria de conversión. */
    offerType?: 'fixed' | 'indexed';
}

// Peso máximo del histórico de conversión sobre el score (se atenúa por confianza).
const CONVERSION_MAX_WEIGHT = 0.15;

export interface SupervisedRecommendation {
    kind: SupervisedRecommendationKind;
    title: string;
    candidate: SupervisedCandidate;
    score: number;
    confidence: RecommendationConfidence;
    reason: string;
}

export interface SupervisedRecommendationResult {
    recommendations: SupervisedRecommendation[];
    guardrails: string[];
}

const MIN_SAVINGS_FOR_COMMERCIAL_RECOMMENDATION = 50;
const MIN_SAVINGS_RATIO_FOR_COMMERCIAL_RECOMMENDATION = 0.01;
const BALANCED_MIN_SAVINGS_RATIO = 0.8;
const COMMISSION_MIN_SAVINGS_RATIO = 0.65;

export function buildSupervisedRecommendations(
    candidates: SupervisedCandidate[],
    options?: { conversionMemory?: ConversionMemory | null; segment?: 'RESIDENCIAL' | 'PYME' | null },
): SupervisedRecommendationResult {
    const conversionMemory = options?.conversionMemory ?? null;
    const segment = options?.segment ?? null;
    const viable = candidates
        .filter(isCommerciallyDefensible)
        .sort((a, b) => b.annualSavings - a.annualSavings);

    if (viable.length === 0) {
        return {
            recommendations: [],
            guardrails: ['No hay ninguna tarifa con ahorro comercialmente defendible. No se debe recomendar propuesta comercial.'],
        };
    }

    const maxSavings = viable[0];
    const bestSavings = Math.max(maxSavings.annualSavings, 1);
    const bestCommission = Math.max(...viable.map(candidate => candidate.estimatedAgentCommission || 0), 1);
    const guardrails: string[] = [];

    const maxSavingsRecommendation = makeRecommendation(
        'max_savings',
        'Maximo ahorro cliente',
        maxSavings,
        scoreCandidate(maxSavings, bestSavings, bestCommission, conversionMemory, segment),
        'Es la opcion que mas reduce el coste anual del cliente.',
    );

    const balancedPool = viable.filter(candidate =>
        candidate.annualSavings >= bestSavings * BALANCED_MIN_SAVINGS_RATIO
    );
    const balanced = pickBestByScore(balancedPool, bestSavings, bestCommission, conversionMemory, segment);

    const commissionPool = viable.filter(candidate =>
        candidate.annualSavings >= bestSavings * COMMISSION_MIN_SAVINGS_RATIO &&
        (candidate.estimatedAgentCommission || 0) > 0
    );
    const bestCommissionCandidate = commissionPool.sort((a, b) =>
        (b.estimatedAgentCommission || 0) - (a.estimatedAgentCommission || 0)
    )[0];

    if (!bestCommissionCandidate) {
        guardrails.push('No hay comision estimada suficiente para proponer una opcion de maxima comision viable.');
    }

    const recommendations = dedupeRecommendations([
        maxSavingsRecommendation,
        makeRecommendation(
            'balanced',
            'Mejor equilibrio',
            balanced,
            scoreCandidate(balanced, bestSavings, bestCommission, conversionMemory, segment),
            balanced.id === maxSavings.id
                ? 'Tambien es la mejor opcion equilibrada porque combina maximo ahorro y buena calidad comercial.'
                : 'Mantiene un ahorro alto frente a la mejor opcion y mejora la oportunidad comercial.',
        ),
        bestCommissionCandidate
            ? makeRecommendation(
                'best_viable_commission',
                'Mejor comision viable',
                bestCommissionCandidate,
                scoreCandidate(bestCommissionCandidate, bestSavings, bestCommission, conversionMemory, segment),
                'Prioriza la comision sin bajar del umbral minimo de ahorro defendible para el cliente.',
            )
            : null,
    ]);

    if (viable.some(candidate => candidate.hasMissingCommission)) {
        guardrails.push('Hay tarifas sin comision estimada. Revisar tabla de comisiones antes de cerrar propuesta.');
    }

    return { recommendations, guardrails };
}

function pickBestByScore(
    candidates: SupervisedCandidate[],
    bestSavings: number,
    bestCommission: number,
    conversionMemory?: ConversionMemory | null,
    segment?: 'RESIDENCIAL' | 'PYME' | null,
): SupervisedCandidate {
    return [...candidates].sort((a, b) =>
        scoreCandidate(b, bestSavings, bestCommission, conversionMemory, segment) -
        scoreCandidate(a, bestSavings, bestCommission, conversionMemory, segment)
    )[0];
}

function isCommerciallyDefensible(candidate: SupervisedCandidate): boolean {
    if (candidate.annualSavings < MIN_SAVINGS_FOR_COMMERCIAL_RECOMMENDATION) return false;

    const estimatedCurrentAnnual = candidate.annualCost + candidate.annualSavings;
    if (estimatedCurrentAnnual <= 0) return false;

    return (candidate.annualSavings / estimatedCurrentAnnual) >= MIN_SAVINGS_RATIO_FOR_COMMERCIAL_RECOMMENDATION;
}

function scoreCandidate(
    candidate: SupervisedCandidate,
    bestSavings: number,
    bestCommission: number,
    conversionMemory?: ConversionMemory | null,
    segment?: 'RESIDENCIAL' | 'PYME' | null,
): number {
    const savingsScore = clamp(candidate.annualSavings / bestSavings);
    const commissionScore = clamp((candidate.estimatedAgentCommission || 0) / bestCommission);
    const confidenceScore = getConfidenceScore(candidate);
    const riskPenalty = ((candidate.criticalAlerts || 0) * 0.35) + ((candidate.warningAlerts || 0) * 0.08);

    const baseScore = (savingsScore * 0.55) + (commissionScore * 0.25) + (confidenceScore * 0.2) - riskPenalty;

    // Ajuste aprendido: histórico de conversión por comercializadora/tipo/segmento.
    // Atenuado por confianza → con pocos datos el efecto es nulo (retrocompatible).
    let conversionAdjustment = 0;
    if (conversionMemory && candidate.offerType) {
        const signal = getConversionSignal(conversionMemory, candidate.company, candidate.offerType, segment);
        conversionAdjustment = conversionDelta(signal, CONVERSION_MAX_WEIGHT);
    }

    return round4(baseScore + conversionAdjustment);
}

function getConfidenceScore(candidate: SupervisedCandidate): number {
    if ((candidate.criticalAlerts || 0) > 0) return 0.25;
    if ((candidate.warningAlerts || 0) >= 3) return 0.55;
    if (candidate.hasMissingCommission) return 0.75;
    return 1;
}

function makeRecommendation(
    kind: SupervisedRecommendationKind,
    title: string,
    candidate: SupervisedCandidate,
    score: number,
    reason: string,
): SupervisedRecommendation {
    return {
        kind,
        title,
        candidate,
        score,
        confidence: score >= 0.8 ? 'high' : score >= 0.55 ? 'medium' : 'low',
        reason,
    };
}

function dedupeRecommendations(
    recommendations: Array<SupervisedRecommendation | null>,
): SupervisedRecommendation[] {
    const seen = new Set<string>();
    const result: SupervisedRecommendation[] = [];

    for (const recommendation of recommendations) {
        if (!recommendation) continue;
        const key = recommendation.candidate.id;
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(recommendation);
    }

    return result;
}

function clamp(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.min(1, Math.max(0, value));
}

function round4(value: number): number {
    return Math.round(value * 10000) / 10000;
}
