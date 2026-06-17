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
    // — Endesa —
    'A81948077', // ENDESA ENERGÍA, S.A.U.
    'B82846825', // ENERGÍA XXI COMERCIALIZADORA DE REFERENCIA, S.L.U.
    // — Iberdrola —
    'A95758389', // IBERDROLA CLIENTES, S.A.U.
    'A95758371', // IBERDROLA ENERGÍA ESPAÑA, S.A.U.
    // — Curenergía —
    'A95554630', // CURENERGÍA COMERCIALIZADOR DE ÚLTIMO RECURSO, S.A.U.
    // — Naturgy —
    'A67760876', // NATURGY CLIENTES, S.A.U.
    'A08431090', // NATURGY CLIENTES EMPRESAS, S.A.U.
    'A65067332', // COMERCIALIZADORA REGULADA, GAS & POWER, S.A.
    // — Repsol —
    'B39540760', // REPSOL COMERCIALIZADORA DE ELECTRICIDAD Y GAS, S.L.U.
    // — Régsiti —
    'B39702436', // RÉGSITI COMERCIALIZADORA REGULADA, S.L.U.
    // — TotalEnergies —
    'A87803862', // TOTALENERGIES ELECTRICIDAD Y GAS ESPAÑA, S.A.U.
    'A95000295', // TOTALENERGIES CLIENTES, S.A.U.
    // — Baser —
    'A74251836', // BASER COMERCIALIZADORA DE REFERENCIA, S.A.
    // — EDP —
    'A33473752', // EDP ESPAÑA, S.A.
    'A95978581', // COMERCIALIZADORA ENERGÉTICA SOSTENIBLE, S.A.U.
    // — Plenitude (Eni) —
    'B39793294', // ENI PLENITUDE IBERIA, S.L.
    // — Gana Energía —
    'B98717457', // GAOLANIA SERVICIOS, S.L.
    // — Logos Energía —
    'B39806062', // BIROU GAS, S.L.
    // — Holaluz —
    'A65445033', // HOLALUZ-CLIDOM, S.A.
    // — Octopus Energy —
    'B40563082', // OCTOPUS ENERGY ESPAÑA, S.L.U.
    // — Podo —
    'B87382644', // GEO ALTERNATIVA, S.L.
    // — Lucera / Pepeenergy —
    'B98670003', // ENERGÍA COLECTIVA, S.L.
    // — Factor Energía —
    'A62943600', // FACTOR ENERGÍA ESPAÑA, S.A.
    // — Audax —
    'A62338827', // AUDAX RENOVABLES, S.A.
    // — Feníe Energía —
    'A85908036', // FENIE ENERGÍA, S.A.
    // — Som Energia —
    'F55091367', // SOM ENERGIA, S.C.C.L.
    // — Alterna —
    'B87075982', // ALTERNA OPERADOR INTEGRAL, S.L.
    // — Galp —
    'A28559573', // GALP ENERGÍA ESPAÑA, S.A.U.
    // — Moeve / Cepsa —
    'A28142552', // MOEVE GAS AND POWER, S.A.U.
    // — Shell —
    'A28013522', // SHELL ESPAÑA, S.A.
    // — BP —
    'A82422031', // BP GAS & POWER IBERIA, S.A.U.
    // — Axpo —
    'B83160994', // AXPO IBERIA, S.L.
    // — Engie —
    'B82508441', // ENGIE ESPAÑA, S.L.
    // — Nexus Energía —
    'A62332580', // NEXUS ENERGÍA, S.A.
    // — Energya VM —
    'B83393066', // ENERGYA VM GESTIÓN DE ENERGÍA, S.L.
    // — Gesternova —
    'A84337849', // GESTERNOVA, S.A.
    // — Acciona —
    'B31737422', // ACCIONA GREEN ENERGY DEVELOPMENTS, S.L.
    // — Imagina Energía / Hanwha —
    'B88480330', // HANWHA ENERGY RETAIL SPAIN, S.L.
    // — Bonpreu —
    'A08665838', // BON PREU, S.A.U.
    // — Novaluz —
    'B93661726', // NOVALUZ ENERGÍA, S.L.
    // — Alcanzia —
    'B98373269', // ALCANZIA ENERGÍA, S.L.
    // — Xenera —
    'A94071727', // XENERA COMPAÑÍA ELÉCTRICA, S.A.
    // — CHC Energía —
    'A74255282', // CIDE HCENERGÍA, S.A.U.
    // — Bassols —
    'B17653213', // BASSOLS ENERGIA COMERCIAL, S.L.
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
