/**
 * Cuándo dos facturas subidas son la misma.
 *
 * Había dos comprobaciones de duplicados, cada una con su propia copia de este
 * razonamiento: la de la subida por lotes miraba la huella del fichero, y la de
 * la subida normal comparaba CUPS y mes con sus propias expresiones regulares.
 * Doce copias de la misma factura entraron por la rendija entre ambas.
 *
 * Aquí vive la parte que no depende de la base de datos, para que las dos
 * comprueben lo mismo y se pueda probar sin montar un entorno.
 */

/** Ámbito en el que buscar duplicados: de quién son las facturas "ya subidas". */
export interface DedupScope {
    column: 'franchise_id' | 'agent_id';
    value: string;
}

/**
 * Decide contra qué facturas comparar.
 *
 * Antes, quien no tenía franquicia se daba por bueno sin comprobar nada. Quien
 * no tiene franquicia es **el administrador** — es el invariante que sostiene su
 * autoridad—, así que la comprobación de duplicados se apagaba justo para el
 * perfil que más facturas mueve. Ahora ese caso cae a su propio ámbito en vez de
 * desactivar la comprobación.
 */
export function resolveDedupScope(profile: {
    franchiseId?: string | null;
    userId: string;
}): DedupScope {
    return profile.franchiseId
        ? { column: 'franchise_id', value: profile.franchiseId }
        : { column: 'agent_id', value: profile.userId };
}

/**
 * El año y mes de una factura, en `AAAA-MM`.
 *
 * El OCR devuelve la fecha en varios formatos según la comercializadora. Se
 * comparan por mes y no por día a propósito: la misma factura leída dos veces
 * puede dar días distintos, pero el periodo facturado no cambia.
 *
 * Devuelve `null` si no se reconoce el formato — y quien llame debe tratar eso
 * como "no lo sé", nunca como "no es duplicado".
 */
export function parseInvoiceYearMonth(raw: string | null | undefined): string | null {
    if (!raw) return null;
    const value = String(raw).trim();

    const iso = value.match(/(\d{4})-(\d{2})/);
    if (iso) return `${iso[1]}-${iso[2]}`;

    const dmy = value.match(/\d{2}\/(\d{2})\/(\d{4})/);
    if (dmy) return `${dmy[2]}-${dmy[1]}`;

    const my = value.match(/(\d{2})\/(\d{4})/);
    if (my) return `${my[2]}-${my[1]}`;

    return null;
}

/** Mismo CUPS, ignorando mayúsculas y espacios. */
export function isSameCups(a: string | null | undefined, b: string | null | undefined): boolean {
    const normaliza = (v: string | null | undefined) => String(v ?? '').trim().toUpperCase();
    const left = normaliza(a);
    return left.length > 0 && left === normaliza(b);
}

/**
 * Dos facturas son la misma si coinciden CUPS y periodo.
 *
 * Si de alguna no se puede leer el periodo, no se afirma que sean la misma: se
 * devuelve `false`, y el aviso tendrá que venir de la huella del fichero.
 */
export function isSameInvoice(
    a: { cups?: string | null; invoiceDate?: string | null },
    b: { cups?: string | null; invoiceDate?: string | null },
): boolean {
    if (!isSameCups(a.cups, b.cups)) return false;

    const periodoA = parseInvoiceYearMonth(a.invoiceDate);
    const periodoB = parseInvoiceYearMonth(b.invoiceDate);
    return periodoA !== null && periodoA === periodoB;
}
