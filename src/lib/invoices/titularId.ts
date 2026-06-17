/**
 * Resolución del DNI/CIF del TITULAR del contrato a partir de los datos crudos
 * del OCR (N8N).
 *
 * Problema: en las facturas aparecen varios identificadores fiscales —el de la
 * COMERCIALIZADORA (siempre un CIF de empresa, p.ej. Iberdrola A95758389), el de
 * la DISTRIBUIDORA, y el del TITULAR (DNI/NIE o CIF, p.ej. 07018279J)—. Nos
 * interesa SOLO el del titular. El OCR puede confundirlos, así que aquí:
 *   1. Se prefieren los campos explícitamente etiquetados como del titular.
 *   2. Se valida el formato fiscal español (DNI/NIE/CIF).
 *   3. Se EXCLUYE cualquier valor que sea de la comercializadora/distribuidora
 *      (lista conocida + campos que el OCR marque como tales).
 *
 * Si no se encuentra un titular válido, devuelve '' — preferible a guardar el
 * CIF equivocado: el paso de campos obligatorios obliga entonces a introducirlo
 * a mano. Ver [[criticalFields]].
 */

// CIFs de comercializadoras/distribuidoras conocidas (ampliable). Nunca son el
// titular. La normalización quita guiones/espacios y pasa a mayúsculas.
export const NON_TITULAR_CIFS = new Set<string>([
    'A95758389', // Iberdrola Clientes, S.A.U.
    'A81948077', // Endesa Energía, S.A.U.
    'A80907397', // Endesa Energía XXI, S.L.U.
    'A65067332', // Naturgy Iberia, S.A.
    'A82018474', // Naturgy / Gas Natural comercializadora
    'A95554630', // Iberdrola Comercialización de Último Recurso
    'A86211801', // Repsol Comercializadora de Electricidad y Gas
    'B85910848', // Holaluz
    'B66202244', // Octopus Energy España
    'A87123275', // TotalEnergies Clientes (aprox.)
    'B98920843', // Plenitude / Eni (aprox.)
]);

export function normalizeTaxId(raw: string): string {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** DNI/NIF (8 dígitos + letra), NIE (X/Y/Z + 7 + letra) o CIF (letra org + 7 + control). */
export function isValidSpanishTaxId(id: string): boolean {
    const v = normalizeTaxId(id);
    return (
        /^[0-9]{8}[A-Z]$/.test(v) ||        // DNI / NIF persona
        /^[XYZ][0-9]{7}[A-Z]$/.test(v) ||   // NIE
        /^[A-W][0-9]{7}[0-9A-J]$/.test(v)   // CIF empresa
    );
}

export function isNonTitularCif(id: string): boolean {
    return NON_TITULAR_CIFS.has(normalizeTaxId(id));
}

// Claves candidatas, en orden de preferencia: primero las etiquetadas como
// "titular", luego las genéricas. Cubre variantes mayús/minús de N8N.
const TITULAR_KEYS = [
    'nif_titular', 'dni_titular', 'cif_titular', 'titular_nif', 'titular_dni',
    'nif_titular_contrato', 'dni_cif_titular', 'titular_id',
];
const GENERIC_KEYS = [
    'dni_cif', 'DNI', 'NIF', 'dni', 'nif', 'CIF_NIF', 'nif_cif', 'CIF', 'cif',
];
// Campos que, si el OCR los provee, son de la comercializadora/distribuidora.
const EXCLUDE_KEYS = [
    'cif_comercializadora', 'comercializadora_cif', 'company_cif', 'cif_empresa',
    'cif_distribuidora', 'distribuidora_cif',
];

function pick(raw: Record<string, unknown>, keys: string[]): string[] {
    return keys
        .map(k => raw[k])
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map(normalizeTaxId);
}

/**
 * Devuelve el DNI/CIF del titular (normalizado) o '' si no se puede resolver
 * uno fiable que no sea de la comercializadora/distribuidora.
 */
export function resolveTitularDniCif(raw: Record<string, unknown>): string {
    const excluded = new Set<string>([...NON_TITULAR_CIFS, ...pick(raw, EXCLUDE_KEYS)]);
    const titular = pick(raw, TITULAR_KEYS);
    const generic = pick(raw, GENERIC_KEYS);

    // 1. Campo etiquetado como titular, válido y no excluido.
    for (const c of titular) if (isValidSpanishTaxId(c) && !excluded.has(c)) return c;
    // 2. Campo genérico válido y no excluido.
    for (const c of generic) if (isValidSpanishTaxId(c) && !excluded.has(c)) return c;
    // 3. Último recurso: titular etiquetado no excluido aunque el formato no encaje
    //    (NIFs raros), pero NUNCA un valor excluido.
    for (const c of titular) if (!excluded.has(c)) return c;
    return '';
}
