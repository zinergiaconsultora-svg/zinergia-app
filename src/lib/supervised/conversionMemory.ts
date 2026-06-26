// ─────────────────────────────────────────────────────────────────────────────
// Conversion Memory — aprendizaje incremental del comparador
//
// El comparador deja de recomendar solo con reglas fijas: aprende de los
// resultados reales de las propuestas. Combina dos señales:
//   • Elección del agente (chosen): qué oferta seleccionó al generar la
//     propuesta. Señal abundante y temprana, pero débil.
//   • Cierre real (won / lost): si la propuesta acabó en cliente firmado o
//     rechazada. Señal escasa pero fuerte.
//
// Clave de diseño: la influencia está PONDERADA POR CONFIANZA según el volumen
// de datos. Con pocas muestras el score es neutral (no sesga); a medida que se
// acumulan propuestas y cierres, gana peso. Así es seguro desde el día cero y
// "aprende a medida que se añaden facturas".
//
// Sin LLM ni coste externo: es agregación estadística sobre datos propios.
// ─────────────────────────────────────────────────────────────────────────────

export type OutcomeSignal = 'chosen' | 'won' | 'lost';

export interface ProposalOutcome {
    /** Comercializadora de la oferta (normalizada en mayúsculas). */
    marketer: string;
    /** Tipo de oferta: fijo o indexado. */
    offerType: 'fixed' | 'indexed';
    /** Segmento del cliente, si se conoce. */
    segment?: 'RESIDENCIAL' | 'PYME' | null;
    signal: OutcomeSignal;
}

export interface ConversionStat {
    chosen: number;
    won: number;
    lost: number;
    /** Score 0..1: >0.5 convierte mejor que la media, <0.5 peor. */
    score: number;
    /** 0..1: cuánta confianza dar al score según el volumen de muestras. */
    confidence: number;
    sampleCount: number;
}

export interface ConversionMemory {
    /** Estadística por clave "MARKETER|TYPE|SEGMENT". */
    byKey: Record<string, ConversionStat>;
    totalOutcomes: number;
}

// Pesos de cada señal (won pesa más que chosen; lost penaliza).
const W_WON = 3;
const W_CHOSEN = 1;
const W_LOST = 2;

// Suavizado bayesiano: K pseudo-muestras centradas en 0.5 → con 0 datos, score = 0.5.
const SMOOTHING_K = 4;
// Muestras necesarias para alcanzar confianza plena.
const CONFIDENCE_FULL_AT = 10;

const NEUTRAL_SCORE = 0.5;

function clamp01(v: number): number {
    if (!Number.isFinite(v)) return 0;
    return Math.min(1, Math.max(0, v));
}

export function buildOutcomeKey(
    marketer: string,
    offerType: 'fixed' | 'indexed',
    segment?: 'RESIDENCIAL' | 'PYME' | null,
): string {
    return `${(marketer || '').trim().toUpperCase()}|${offerType}|${segment ?? 'ANY'}`;
}

/**
 * Construye la memoria de conversión a partir de los resultados de las propuestas.
 * Determinista y puro: misma entrada → misma salida.
 */
export function buildConversionMemory(outcomes: ProposalOutcome[]): ConversionMemory {
    const acc: Record<string, { chosen: number; won: number; lost: number }> = {};

    for (const o of outcomes) {
        if (!o.marketer) continue;
        const key = buildOutcomeKey(o.marketer, o.offerType, o.segment);
        if (!acc[key]) acc[key] = { chosen: 0, won: 0, lost: 0 };
        acc[key][o.signal] += 1;
    }

    const byKey: Record<string, ConversionStat> = {};
    for (const [key, c] of Object.entries(acc)) {
        byKey[key] = toStat(c);
    }

    return { byKey, totalOutcomes: outcomes.length };
}

function toStat(c: { chosen: number; won: number; lost: number }): ConversionStat {
    const positive = c.won * W_WON + c.chosen * W_CHOSEN;
    const negative = c.lost * W_LOST;
    const totalWeight = positive + negative;

    // Score suavizado: arranca en 0.5 y se desplaza con la evidencia ponderada.
    const score = clamp01(
        (positive + NEUTRAL_SCORE * SMOOTHING_K) / (totalWeight + SMOOTHING_K),
    );

    const sampleCount = c.chosen + c.won + c.lost;
    const confidence = clamp01(sampleCount / CONFIDENCE_FULL_AT);

    return { chosen: c.chosen, won: c.won, lost: c.lost, score, confidence, sampleCount };
}

/**
 * Devuelve el ajuste de conversión para un candidato concreto, buscando la clave
 * más específica disponible (marketer+type+segment → marketer+type → marketer).
 * Si no hay datos, devuelve neutral con confianza 0 (efecto nulo en el ranking).
 */
export function getConversionSignal(
    memory: ConversionMemory | null | undefined,
    marketer: string,
    offerType: 'fixed' | 'indexed',
    segment?: 'RESIDENCIAL' | 'PYME' | null,
): { score: number; confidence: number } {
    if (!memory) return { score: NEUTRAL_SCORE, confidence: 0 };

    const candidates = [
        buildOutcomeKey(marketer, offerType, segment),
        buildOutcomeKey(marketer, offerType, null),
    ];

    for (const key of candidates) {
        const stat = memory.byKey[key];
        if (stat && stat.sampleCount > 0) {
            return { score: stat.score, confidence: stat.confidence };
        }
    }

    return { score: NEUTRAL_SCORE, confidence: 0 };
}

/**
 * Convierte la señal de conversión en un delta de score centrado en 0,
 * atenuado por la confianza. Con confianza 0 el delta es 0 (sin efecto).
 *
 * @returns delta en el rango [-maxWeight, +maxWeight] * confidence
 */
export function conversionDelta(
    signal: { score: number; confidence: number },
    maxWeight: number,
): number {
    // (score - 0.5) * 2 mapea 0..1 → -1..1 (señal centrada).
    const centered = (signal.score - NEUTRAL_SCORE) * 2;
    return centered * signal.confidence * maxWeight;
}
