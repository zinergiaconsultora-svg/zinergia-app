/**
 * Cuánto cobra un colaborador por una operación.
 *
 * El modelo nuevo tiene dos piezas que se suman:
 *
 *   1. Un **porcentaje propio**, fijado al dar de alta al colaborador y
 *      modificable después. Se aplica sobre lo que la operación genera según el
 *      catálogo de comisiones.
 *   2. Un **extra en euros**, opcional, que la administración añade a una
 *      operación concreta al convertir el lead en cliente.
 *
 * Sustituye al reparto a tres bandas (colaborador / franquicia / central), que
 * dejó de tener sentido al desaparecer las franquicias.
 */

/** Porcentaje en puntos básicos: 6500 = 65 %. Evita arrastrar decimales. */
export type RateBps = number;

export interface CollaboratorCommissionInput {
    /** Comisión que la operación genera según catálogo, en euros. */
    readonly grossCommission: number;
    /** Porcentaje del colaborador vigente al cerrar. `null` si nunca se le fijó. */
    readonly rateBps: RateBps | null;
    /** Extra en euros que la administración añadió a esta operación. */
    readonly extraAmount?: number;
}

export interface CollaboratorCommissionResult {
    /** Lo que sale del porcentaje. */
    readonly fromRate: number;
    /** Lo que sale del extra. */
    readonly fromExtra: number;
    /** Lo que cobra el colaborador. */
    readonly total: number;
    /** Lo que queda para la empresa. Nunca negativo. */
    readonly companyShare: number;
    /**
     * Por qué no se puede calcular, si es el caso. Que esto tenga valor NO
     * significa cero: significa que falta configurar algo y alguien debe verlo.
     */
    readonly missingRate: boolean;
}

function round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Un porcentaje sin fijar devuelve `missingRate` y cero.
 *
 * Es deliberado que no caiga a un valor por defecto: pagar el 0 % o un 50 %
 * inventado son igual de malos, y ambos ocurren en silencio. Quien llame debe
 * mostrar el aviso, como ya hace el comparador con las tarifas sin comisión.
 */
export function calculateCollaboratorCommission(
    input: CollaboratorCommissionInput,
): CollaboratorCommissionResult {
    const gross = Number.isFinite(input.grossCommission) ? Math.max(0, input.grossCommission) : 0;
    const extra = Number.isFinite(input.extraAmount ?? 0) ? Math.max(0, input.extraAmount ?? 0) : 0;

    if (input.rateBps === null || input.rateBps === undefined) {
        return {
            fromRate: 0,
            fromExtra: round2(extra),
            total: round2(extra),
            companyShare: round2(gross),
            missingRate: true,
        };
    }

    const rate = Math.min(10000, Math.max(0, input.rateBps));
    const fromRate = round2((gross * rate) / 10000);
    const fromExtra = round2(extra);
    const total = round2(fromRate + fromExtra);

    // El extra lo pone la empresa de su parte. Si supera lo que quedaba, la parte
    // de la empresa es cero, no negativa: un número negativo aquí acabaría en una
    // liquidación como si el colaborador debiera dinero.
    const companyShare = round2(Math.max(0, gross - total));

    return { fromRate, fromExtra, total, companyShare, missingRate: false };
}

/** Un porcentaje legible, para pantalla: 6500 → "65 %". */
export function formatRate(rateBps: RateBps | null | undefined): string {
    if (rateBps === null || rateBps === undefined) return 'Sin configurar';
    const percent = rateBps / 100;
    return `${Number.isInteger(percent) ? percent : percent.toFixed(2)} %`;
}

/**
 * Convierte lo que se escribe en pantalla (65, 65,5) a puntos básicos.
 *
 * El campo vacío devuelve `null`, no cero. `Number('')` es 0 en JavaScript, así
 * que sin esta comprobación dejar el hueco en blanco fijaría un 0 % — un
 * colaborador que no cobra nada, guardado sin que nadie lo escribiera.
 */
export function parseRatePercent(input: string | number): RateBps | null {
    if (typeof input === 'string' && input.trim() === '') return null;
    const value = typeof input === 'number' ? input : Number(String(input).replace(',', '.').trim());
    if (!Number.isFinite(value) || value < 0 || value > 100) return null;
    return Math.round(value * 100);
}
