import { InvoiceData, TariffPeriod } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Consumption Profile & Contracting Strategy
//
// Adapts senior energy-procurement expertise (load factor analysis, fixed-vs-
// index decision framework) to the Spanish SMB market: tarifas 2.0TD / 3.0TD /
// 6.1TD, periodos P1-P6, mercado libre fijo vs indexado al mercado mayorista
// (OMIE). All functions are pure and deterministic so they can be reused from
// the Aletheia engine, the proposal PDF, and the simulator UI.
// ─────────────────────────────────────────────────────────────────────────────

export type LoadProfileClass = 'flat' | 'moderate' | 'peaky';
export type ContractingStrategy = 'fijo' | 'indexado' | 'fijo_discriminacion';
export type StrategyConfidence = 'alta' | 'media' | 'baja';

export interface ConsumptionProfileResult {
    /** Factor de carga (0..1): demanda media / demanda pico. */
    loadFactor: number;
    /** Factor de carga redondeado a porcentaje entero. */
    loadFactorPct: number;
    /** Demanda pico estimada (kW): maxímetro si existe, si no la potencia contratada. */
    peakKw: number;
    /** Demanda media (kW) en el periodo facturado. */
    avgKw: number;
    /** Ratio pico/media: cuanto más alto, más "picudo" e ineficiente el perfil. */
    peakToAverage: number;
    classification: LoadProfileClass;
    /** Cuota de energía consumida en el periodo valle (P3 en 2.0TD, P6 en el resto). */
    valleyRatio: number;
    /** Cuota de energía en horario comercial diurno (P1 + P2). */
    businessRatio: number;
    /** True si la potencia contratada supera holgadamente la demanda pico real. */
    powerOvercontracted: boolean;
    /** Narrativa breve lista para mostrar al agente o incrustar en el PDF. */
    narrative: string;
}

export interface ContractingStrategyResult {
    strategy: ContractingStrategy;
    /** Etiqueta humana en español. */
    label: string;
    confidence: StrategyConfidence;
    /** Motivos ordenados por relevancia (viñetas). */
    rationale: string[];
}

export interface ConsumptionAnalysis {
    profile: ConsumptionProfileResult;
    strategy: ContractingStrategyResult;
}

// Umbral de clasificación del factor de carga.
const LOAD_FACTOR_FLAT = 0.6;
const LOAD_FACTOR_PEAKY = 0.35;
// Margen de seguridad sobre el maxímetro: si la potencia contratada lo supera, está sobrecontratada.
const OVERCONTRACT_MARGIN = 1.2;
const HOURS_PER_DAY = 24;

function activePeriods(tariffType: InvoiceData['tariff_type']): TariffPeriod[] {
    return tariffType === '2.0TD' ? ['p1', 'p2', 'p3'] : ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
}

function valleyPeriod(tariffType: InvoiceData['tariff_type']): TariffPeriod {
    return tariffType === '2.0TD' ? 'p3' : 'p6';
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function sumPeriods(record: Record<TariffPeriod, number>, periods: TariffPeriod[]): number {
    return periods.reduce((total, p) => total + (record[p] || 0), 0);
}

/**
 * Calcula el factor de carga y la forma del perfil de consumo a partir de la
 * factura. El factor de carga es la métrica fundamental de procurement: un valor
 * bajo (<0.35) indica un consumo muy picudo donde el término de potencia domina
 * y la optimización de potencia tiene el mayor ROI; un valor alto (>0.6) indica
 * consumo plano y predecible.
 */
export function analyzeConsumptionProfile(data: InvoiceData): ConsumptionProfileResult {
    const periods = activePeriods(data.tariff_type);
    const totalKwh = sumPeriods(data.energy_consumption, periods);
    const days = Math.max(1, data.days_involced || 0);
    const hours = days * HOURS_PER_DAY;

    // Demanda pico: preferimos el maxímetro real; si no, la potencia contratada.
    const demandSource = data.max_demand ?? data.contracted_power;
    const peakKw = periods.reduce((max, p) => Math.max(max, demandSource[p] || 0), 0);
    const contractedPeak = periods.reduce((max, p) => Math.max(max, data.contracted_power[p] || 0), 0);

    const avgKw = hours > 0 ? totalKwh / hours : 0;
    const loadFactor = peakKw > 0 ? clamp(avgKw / peakKw, 0, 1) : 0;
    const peakToAverage = avgKw > 0 ? peakKw / avgKw : 0;

    const valleyRatio = totalKwh > 0 ? (data.energy_consumption[valleyPeriod(data.tariff_type)] || 0) / totalKwh : 0;
    const businessRatio = totalKwh > 0
        ? ((data.energy_consumption.p1 || 0) + (data.energy_consumption.p2 || 0)) / totalKwh
        : 0;

    let classification: LoadProfileClass = 'moderate';
    if (loadFactor >= LOAD_FACTOR_FLAT) classification = 'flat';
    else if (loadFactor > 0 && loadFactor < LOAD_FACTOR_PEAKY) classification = 'peaky';

    // Sobrecontratación: la potencia contratada supera el maxímetro real con margen.
    const realPeakDemand = data.max_demand
        ? periods.reduce((max, p) => Math.max(max, data.max_demand![p] || 0), 0)
        : 0;
    const powerOvercontracted = realPeakDemand > 0 && contractedPeak > realPeakDemand * OVERCONTRACT_MARGIN;

    return {
        loadFactor,
        loadFactorPct: Math.round(loadFactor * 100),
        peakKw,
        avgKw,
        peakToAverage,
        classification,
        valleyRatio,
        businessRatio,
        powerOvercontracted,
        narrative: buildNarrative({ loadFactor, classification, valleyRatio, businessRatio, powerOvercontracted }),
    };
}

function buildNarrative(input: {
    loadFactor: number;
    classification: LoadProfileClass;
    valleyRatio: number;
    businessRatio: number;
    powerOvercontracted: boolean;
}): string {
    const pct = Math.round(input.loadFactor * 100);
    const parts: string[] = [];

    if (input.classification === 'flat') {
        parts.push(`Consumo plano y predecible (factor de carga ${pct}%).`);
    } else if (input.classification === 'peaky') {
        parts.push(`Consumo muy picudo (factor de carga ${pct}%): el término de potencia pesa más que la energía.`);
    } else {
        parts.push(`Perfil de consumo mixto (factor de carga ${pct}%).`);
    }

    if (input.powerOvercontracted) {
        parts.push('La potencia contratada supera holgadamente la demanda real registrada: hay margen claro de ajuste.');
    }

    if (input.valleyRatio >= 0.4) {
        parts.push(`El ${Math.round(input.valleyRatio * 100)}% del consumo se concentra en horas valle.`);
    } else if (input.businessRatio >= 0.6) {
        parts.push(`El ${Math.round(input.businessRatio * 100)}% del consumo es en horario comercial diurno.`);
    }

    return parts.join(' ');
}

/**
 * Recomienda una estrategia de contratación (precio fijo, indexado al mercado
 * mayorista, o fijo con discriminación horaria) según el perfil de consumo.
 *
 * Adaptación del marco de decisión "Procurement Strategy Selection" al contexto
 * PYME/autónomo español: el eje real es certeza presupuestaria (fijo) frente a
 * coste medio menor con variabilidad (indexado), modulado por la flexibilidad
 * horaria del negocio.
 */
export function recommendContractingStrategy(profile: ConsumptionProfileResult): ContractingStrategyResult {
    const valleyPct = Math.round(profile.valleyRatio * 100);
    const businessPct = Math.round(profile.businessRatio * 100);

    // 1. Consumo diurno concentrado y poco valle → fijo (protege de volatilidad punta).
    if (profile.businessRatio > 0.6 && profile.valleyRatio < 0.25) {
        return {
            strategy: 'fijo',
            label: 'Precio fijo',
            confidence: 'alta',
            rationale: [
                `El ${businessPct}% del consumo es en horario comercial diurno (P1/P2), las horas más caras del mercado.`,
                'El precio fijo blinda la factura frente a la volatilidad del mercado mayorista en horas punta.',
                'Aporta certeza presupuestaria, prioritaria cuando la energía es un coste operativo relevante.',
            ],
        };
    }

    // 2. Mucho consumo en valle → indexado (aprovecha precios bajos nocturnos del pool).
    if (profile.valleyRatio >= 0.4) {
        return {
            strategy: 'indexado',
            label: 'Indexado al mercado (OMIE)',
            confidence: 'media',
            rationale: [
                `El ${valleyPct}% del consumo se realiza en horas valle, donde el precio del mercado mayorista suele ser más bajo.`,
                'Una tarifa indexada traslada esos precios bajos a la factura, reduciendo el coste medio del kWh.',
                'Contrapartida: la factura varía mes a mes; conviene si el negocio tolera cierta variabilidad presupuestaria.',
            ],
        };
    }

    // 3. Consumo muy estable → fijo (certeza sin penalización por perfil plano).
    if (profile.classification === 'flat') {
        return {
            strategy: 'fijo',
            label: 'Precio fijo',
            confidence: 'alta',
            rationale: [
                `Consumo muy estable y predecible (factor de carga ${profile.loadFactorPct}%).`,
                'Con un perfil plano, el precio fijo da máxima tranquilidad sin sobrecoste relevante frente al indexado.',
                'Facilita la previsión de tesorería y elimina sorpresas en meses de mercado tensionado.',
            ],
        };
    }

    // 4. Perfil mixto → fijo con discriminación horaria (equilibrio).
    return {
        strategy: 'fijo_discriminacion',
        label: 'Fijo con discriminación horaria',
        confidence: 'media',
        rationale: [
            'Perfil de consumo mixto, sin una concentración horaria dominante.',
            'Una tarifa fija con discriminación horaria fija el precio pero premia el consumo desplazado a horas valle.',
            'Equilibra certeza de precio y aprovechamiento de las horas baratas sin exponerse al mercado spot.',
        ],
    };
}

/** Análisis completo: perfil + estrategia recomendada, en una sola llamada. */
export function analyzeConsumption(data: InvoiceData): ConsumptionAnalysis {
    const profile = analyzeConsumptionProfile(data);
    return { profile, strategy: recommendContractingStrategy(profile) };
}
