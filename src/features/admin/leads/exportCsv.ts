import type { InvoiceProcessStatus, InvoiceRegistryRow } from '@/app/actions/invoices';

const STATUS_LABEL: Record<InvoiceProcessStatus, string> = {
    uploaded: 'Subida',
    ocr_done: 'OCR listo',
    compared: 'Comparada',
    closed_won: 'Cliente',
    closed_lost: 'Perdido',
    failed: 'Error OCR',
};

/** Quotes a CSV field when it contains a delimiter, quote or newline (RFC 4180). */
export function csvEscape(value: unknown): string {
    if (value === null || value === undefined) return '';
    const s = String(value);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUMNS: { header: string; get: (r: InvoiceRegistryRow) => unknown }[] = [
    { header: 'Titular', get: (r) => r.titular ?? '' },
    { header: 'Comercial', get: (r) => r.agent_name ?? '' },
    { header: 'Franquicia', get: (r) => r.franchise_name ?? '' },
    { header: 'Estado', get: (r) => STATUS_LABEL[r.process_status] ?? r.process_status },
    { header: 'Comercializadora actual', get: (r) => r.comercializadora_actual ?? '' },
    { header: 'Tarifa actual', get: (r) => r.tarifa_actual ?? '' },
    { header: 'CUPS', get: (r) => r.cups ?? '' },
    { header: 'Importe (€)', get: (r) => r.importe_total ?? '' },
    { header: 'Ahorro anual (€)', get: (r) => r.annual_savings ?? '' },
    { header: 'Ahorro (%)', get: (r) => r.savings_percent ? `${r.savings_percent.toFixed(1)}%` : '' },
    { header: 'Tiene propuesta', get: (r) => r.has_proposal ? 'Sí' : 'No' },
    { header: 'Compañía cerrada', get: (r) => r.compania_contratada ?? '' },
    { header: 'Tarifa cerrada', get: (r) => r.tarifa_contratada ?? '' },
    { header: 'Comisión (€)', get: (r) => r.commission_amount ?? '' },
    { header: 'Motivo pérdida', get: (r) => r.lost_reason ?? '' },
    { header: 'Permanencia hasta', get: (r) => r.permanencia_hasta ?? '' },
    { header: 'En Drive', get: (r) => r.archived_in_drive ? 'Sí' : 'No' },
    { header: 'Fecha subida', get: (r) => r.created_at ? r.created_at.slice(0, 10) : '' },
    { header: 'Fecha comparación', get: (r) => r.compared_at ? r.compared_at.slice(0, 10) : '' },
    { header: 'Fecha cierre', get: (r) => r.closed_at ? r.closed_at.slice(0, 10) : '' },
];

/** Builds an RFC-4180 CSV (semicolon-delimited for Excel-ES) from registry rows. */
export function buildLeadsCsv(rows: InvoiceRegistryRow[]): string {
    const header = COLUMNS.map((c) => csvEscape(c.header)).join(';');
    const lines = rows.map((r) => COLUMNS.map((c) => csvEscape(c.get(r))).join(';'));
    return [header, ...lines].join('\r\n');
}
