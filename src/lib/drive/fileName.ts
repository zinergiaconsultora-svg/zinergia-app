/**
 * Drive file naming — RGPD-safe.
 *
 * Invoice files stored in Google Drive must NOT carry PII in their name, because
 * the name is visible in Drive metadata and share links. In this codebase the
 * titular, DNI/CIF and CUPS are all PII (see docs/rgpd-runbook.md), so the file
 * name is built from non-personal data only: a fixed prefix, the invoice month,
 * and a short slice of the document UUID. All PII stays encrypted in the database.
 *
 *      factura-<yyyymm|sinfecha>-<shortid>.<ext>
 */

const MIME_EXTENSIONS: Record<string, string> = {
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

/** Maps an allowed invoice mime type to a file extension, `bin` as fallback. */
export function extensionForMime(mimeType: string): string {
    return MIME_EXTENSIONS[mimeType] ?? 'bin';
}

const EXTENSION_MIMES: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
};

/** Infers a mime type from a file name's extension. Defaults to PDF. */
export function mimeTypeForFileName(name: string): string {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    return EXTENSION_MIMES[ext] ?? 'application/pdf';
}

interface BuildInvoiceFileNameInput {
    /** The client_documents row UUID. Used only as an opaque short id. */
    documentId: string;
    /** Invoice issue date (ISO string or Date). Only the year+month is used. */
    invoiceDate?: string | Date;
    mimeType: string;
}

function toYearMonth(invoiceDate: string | Date | undefined): string {
    if (!invoiceDate) return 'sinfecha';
    const d = invoiceDate instanceof Date ? invoiceDate : new Date(invoiceDate);
    if (Number.isNaN(d.getTime())) return 'sinfecha';
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${year}${month}`;
}

/**
 * Build a PII-free Drive file name. Throws if no document id is provided, so we
 * never create an unidentifiable file.
 */
export function buildInvoiceFileName({
    documentId,
    invoiceDate,
    mimeType,
}: BuildInvoiceFileNameInput): string {
    const shortId = documentId.replace(/-/g, '').slice(0, 8).toLowerCase();
    if (shortId.length === 0) {
        throw new Error('buildInvoiceFileName: documentId is required');
    }
    const month = toYearMonth(invoiceDate);
    const ext = extensionForMime(mimeType);
    return `factura-${month}-${shortId}.${ext}`;
}
