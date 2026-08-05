/**
 * Lectura de la hoja de cálculo de decomisiones.
 *
 * Las condiciones de decomisión llegan de los contratos con cada comercializadora,
 * en papel. La forma práctica de trasladarlas es una hoja de cálculo: una fila por
 * tramo, agrupadas por comercializadora y producto.
 *
 * Este módulo la convierte en la entrada exacta que espera
 * `configure_decommission_policy`, y aplica **las mismas reglas que la función de
 * base de datos** antes de llamarla. La función ya valida —los tramos deben ser
 * continuos desde el día 0, no crecientes, y cubrir toda la ventana—, pero sus
 * errores son códigos SQL. Validar aquí permite decir en qué fila del fichero está
 * el problema, que es lo único accionable para quien rellena la hoja.
 *
 * No es una validación alternativa: si estas reglas y las de la base de datos
 * divergen, mandan las de la base de datos.
 */

/** Una fila de la hoja, ya con las columnas reconocidas. */
export interface DecommissionCsvRow {
    comercializadora: string;
    producto: string;
    diasConsolidacion: number;
    diasClawback: number;
    tramoDesdeDia: number;
    tramoHastaDia: number;
    porcentajeDevolucion: number;
}

/** Un tramo tal y como lo espera la función de base de datos. */
export interface DecommissionBandInput {
    activeDayFrom: number;
    activeDayTo: number;
    reversalBps: number;
}

/** Una política completa, lista para enviar. */
export interface DecommissionPolicyInput {
    marketerName: string;
    productCode: string | null;
    consolidationDays: number;
    clawbackDays: number;
    bands: DecommissionBandInput[];
    /** Filas del fichero de las que sale, para poder señalarlas en un error. */
    sourceLines: number[];
}

export interface ParseResult {
    policies: DecommissionPolicyInput[];
    errors: string[];
}

const REQUIRED_COLUMNS = [
    'comercializadora',
    'producto',
    'dias_consolidacion',
    'dias_clawback',
    'tramo_desde_dia',
    'tramo_hasta_dia',
    'porcentaje_devolucion',
] as const;

// Límites de `configure_decommission_policy`. Repetidos aquí para poder avisar
// antes de la llamada; la base de datos los vuelve a comprobar igualmente.
const MAX_DAYS = 3650;
const MAX_BANDS_PER_POLICY = 12;
const MIN_MARKETER_LENGTH = 2;
const MAX_MARKETER_LENGTH = 120;
const MAX_PRODUCT_LENGTH = 80;

/** Un porcentaje (0-100) en puntos básicos (0-10000), sin decimales perdidos. */
export function percentageToBps(percentage: number): number {
    return Math.round(percentage * 100);
}

function splitCsvLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
        const char = line[i];

        if (char === '"' && line[i + 1] === '"') {
            current += '"';
            i += 1;
            continue;
        }
        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }
        if ((char === ',' || char === ';') && !inQuotes) {
            values.push(current);
            current = '';
            continue;
        }
        current += char;
    }

    values.push(current);
    return values.map(value => value.trim());
}

function parseInteger(raw: string): number | null {
    if (!/^-?\d+$/.test(raw.trim())) return null;
    return Number(raw.trim());
}

function parsePercentage(raw: string): number | null {
    const clean = raw.trim().replace('%', '').replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(clean)) return null;
    const value = Number(clean);
    return value >= 0 && value <= 100 ? value : null;
}

/**
 * Convierte el contenido de la hoja en políticas listas para enviar.
 *
 * Devuelve siempre las dos cosas: lo que se ha podido leer y lo que ha fallado.
 * Quien llame decide si envía algo con errores presentes — el cargador no lo hace.
 */
export function parseDecommissionCsv(content: string): ParseResult {
    const errors: string[] = [];
    const lines = content
        .replace(/^﻿/, '')
        .split(/\r?\n/)
        .map((line, index) => ({ line, number: index + 1 }))
        .filter(entry => entry.line.trim().length > 0 && !entry.line.trim().startsWith('#'));

    if (lines.length === 0) {
        return { policies: [], errors: ['El fichero está vacío.'] };
    }

    const headers = splitCsvLine(lines[0].line).map(header => header.toLowerCase());
    const missing = REQUIRED_COLUMNS.filter(column => !headers.includes(column));
    if (missing.length > 0) {
        return {
            policies: [],
            errors: [`Faltan columnas obligatorias: ${missing.join(', ')}.`],
        };
    }

    const rows: Array<{ row: DecommissionCsvRow; lineNumber: number }> = [];

    for (const entry of lines.slice(1)) {
        const values = splitCsvLine(entry.line);
        const get = (column: string) => values[headers.indexOf(column)] ?? '';

        const comercializadora = get('comercializadora');
        const diasConsolidacion = parseInteger(get('dias_consolidacion'));
        const diasClawback = parseInteger(get('dias_clawback'));
        const tramoDesdeDia = parseInteger(get('tramo_desde_dia'));
        const tramoHastaDia = parseInteger(get('tramo_hasta_dia'));
        const porcentajeDevolucion = parsePercentage(get('porcentaje_devolucion'));

        if (comercializadora.length < MIN_MARKETER_LENGTH || comercializadora.length > MAX_MARKETER_LENGTH) {
            errors.push(`Línea ${entry.number}: la comercializadora debe tener entre ${MIN_MARKETER_LENGTH} y ${MAX_MARKETER_LENGTH} caracteres.`);
            continue;
        }
        if (get('producto').length > MAX_PRODUCT_LENGTH) {
            errors.push(`Línea ${entry.number}: el producto no puede pasar de ${MAX_PRODUCT_LENGTH} caracteres.`);
            continue;
        }
        if (diasConsolidacion === null || diasClawback === null || tramoDesdeDia === null || tramoHastaDia === null) {
            errors.push(`Línea ${entry.number}: los días deben ser números enteros.`);
            continue;
        }
        if (porcentajeDevolucion === null) {
            errors.push(`Línea ${entry.number}: el porcentaje de devolución debe estar entre 0 y 100.`);
            continue;
        }
        if (diasConsolidacion < 0 || diasConsolidacion > MAX_DAYS) {
            errors.push(`Línea ${entry.number}: los días de consolidación deben estar entre 0 y ${MAX_DAYS}.`);
            continue;
        }
        if (diasClawback < diasConsolidacion || diasClawback > MAX_DAYS) {
            errors.push(`Línea ${entry.number}: los días de reclamación deben ir de los de consolidación a ${MAX_DAYS}.`);
            continue;
        }

        rows.push({
            lineNumber: entry.number,
            row: {
                comercializadora,
                producto: get('producto'),
                diasConsolidacion,
                diasClawback,
                tramoDesdeDia,
                tramoHastaDia,
                porcentajeDevolucion,
            },
        });
    }

    const grouped = new Map<string, { row: DecommissionCsvRow; lineNumber: number }[]>();
    for (const entry of rows) {
        const key = `${entry.row.comercializadora.toLowerCase()}::${entry.row.producto.toLowerCase()}`;
        const bucket = grouped.get(key);
        if (bucket) bucket.push(entry);
        else grouped.set(key, [entry]);
    }

    const policies: DecommissionPolicyInput[] = [];

    for (const entries of grouped.values()) {
        const first = entries[0].row;
        const label = first.producto ? `${first.comercializadora} / ${first.producto}` : first.comercializadora;

        // Una política tiene una sola ventana. Si las filas de un mismo grupo no
        // coinciden, es un error de transcripción y no hay forma de saber cuál vale.
        const inconsistent = entries.find(
            entry => entry.row.diasConsolidacion !== first.diasConsolidacion
                || entry.row.diasClawback !== first.diasClawback,
        );
        if (inconsistent) {
            errors.push(`${label}: las filas no coinciden en días de consolidación o reclamación (línea ${inconsistent.lineNumber}).`);
            continue;
        }

        if (entries.length > MAX_BANDS_PER_POLICY) {
            errors.push(`${label}: ${entries.length} tramos, el máximo es ${MAX_BANDS_PER_POLICY}.`);
            continue;
        }

        const ordered = [...entries].sort((a, b) => a.row.tramoDesdeDia - b.row.tramoDesdeDia);
        const bands: DecommissionBandInput[] = [];
        let expectedFrom = 0;
        let previousBps = Number.POSITIVE_INFINITY;
        let broken = false;

        for (const entry of ordered) {
            const { tramoDesdeDia, tramoHastaDia, porcentajeDevolucion } = entry.row;
            const bps = percentageToBps(porcentajeDevolucion);

            if (tramoDesdeDia !== expectedFrom) {
                errors.push(`${label}: el tramo de la línea ${entry.lineNumber} empieza en el día ${tramoDesdeDia} y debería empezar en el ${expectedFrom}; los tramos no pueden dejar huecos ni solaparse.`);
                broken = true;
                break;
            }
            if (tramoHastaDia < tramoDesdeDia) {
                errors.push(`${label}: el tramo de la línea ${entry.lineNumber} acaba antes de empezar.`);
                broken = true;
                break;
            }
            if (tramoHastaDia > first.diasClawback) {
                errors.push(`${label}: el tramo de la línea ${entry.lineNumber} llega al día ${tramoHastaDia}, más allá de la ventana de reclamación (${first.diasClawback}).`);
                broken = true;
                break;
            }
            // Cuanto más tiempo aguanta el contrato, menos se devuelve. Un tramo que
            // devuelve más que el anterior es casi siempre una fila mal ordenada.
            if (bps > previousBps) {
                errors.push(`${label}: el tramo de la línea ${entry.lineNumber} devuelve más que el tramo anterior; el porcentaje no puede subir con el tiempo.`);
                broken = true;
                break;
            }

            bands.push({ activeDayFrom: tramoDesdeDia, activeDayTo: tramoHastaDia, reversalBps: bps });
            expectedFrom = tramoHastaDia + 1;
            previousBps = bps;
        }

        if (broken) continue;

        if (expectedFrom !== first.diasClawback + 1) {
            errors.push(`${label}: los tramos cubren hasta el día ${expectedFrom - 1}, pero la ventana de reclamación llega al ${first.diasClawback}. Falta un tramo final.`);
            continue;
        }

        policies.push({
            marketerName: first.comercializadora,
            productCode: first.producto ? first.producto : null,
            consolidationDays: first.diasConsolidacion,
            clawbackDays: first.diasClawback,
            bands,
            sourceLines: ordered.map(entry => entry.lineNumber),
        });
    }

    return { policies, errors };
}

/** Resumen legible de una política, para confirmar antes de enviarla. */
export function describePolicy(policy: DecommissionPolicyInput): string {
    const target = policy.productCode
        ? `${policy.marketerName} / ${policy.productCode}`
        : `${policy.marketerName} (todos los productos)`;
    const bands = policy.bands
        .map(band => `  días ${band.activeDayFrom}-${band.activeDayTo}: devuelve ${band.reversalBps / 100}%`)
        .join('\n');
    return `${target}\n  consolida a los ${policy.consolidationDays} días, reclamable hasta el ${policy.clawbackDays}\n${bands}`;
}
