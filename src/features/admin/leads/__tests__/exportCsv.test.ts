import { describe, it, expect } from 'vitest';
import { csvEscape, buildLeadsCsv } from '../exportCsv';
import type { InvoiceRegistryRow } from '@/app/actions/invoices';

function row(overrides: Partial<InvoiceRegistryRow> = {}): InvoiceRegistryRow {
    return {
        job_id: 'j1', agent_id: 'a1', franchise_id: null, created_at: '2026-06-24T10:00:00.000Z',
        ocr_status: 'completed', compared_at: null, drive_view_link: null, drive_synced_at: '2026-06-24T10:05:00Z',
        archived_in_drive: true, process_status: 'closed_won', titular: 'Juan Muñoz',
        comercializadora_actual: 'Iberdrola', cups: 'ES0021', importe_total: '85,40', tarifa_actual: '2.0TD',
        closed: true, lost: false, lost_reason: null, compania_contratada: 'Endesa', tarifa_contratada: '2.0TD',
        permanencia_hasta: '2027-06-24', commission_amount: 45, closed_at: '2026-06-24T11:00:00Z',
        agent_name: 'Ana, Comercial', franchise_name: null,
        period_days: '30', annual_savings: null, savings_percent: null, has_proposal: false, reviewed_at: null,
        ...overrides,
    };
}

describe('csvEscape', () => {
    it('leaves plain values untouched', () => {
        expect(csvEscape('Endesa')).toBe('Endesa');
        expect(csvEscape(45)).toBe('45');
    });
    it('returns empty string for null/undefined', () => {
        expect(csvEscape(null)).toBe('');
        expect(csvEscape(undefined)).toBe('');
    });
    it('quotes and escapes values with delimiter, quotes or newlines', () => {
        expect(csvEscape('Ana, Comercial')).toBe('"Ana, Comercial"');
        expect(csvEscape('dice "hola"')).toBe('"dice ""hola"""');
        expect(csvEscape('línea1\nlínea2')).toBe('"línea1\nlínea2"');
    });
});

describe('buildLeadsCsv', () => {
    it('emits a header plus one line per row', () => {
        const csv = buildLeadsCsv([row(), row({ titular: 'Otro' })]);
        const lines = csv.split('\r\n');
        expect(lines).toHaveLength(3);
        expect(lines[0]).toContain('Titular');
        expect(lines[0]).toContain('Comisión');
    });
    it('maps the status to a Spanish label and escapes commas in names', () => {
        const csv = buildLeadsCsv([row()]);
        expect(csv).toContain('Cliente'); // closed_won label
        expect(csv).toContain('"Ana, Comercial"'); // escaped
    });
    it('handles an empty selection (header only)', () => {
        expect(buildLeadsCsv([])).not.toContain('\r\n');
    });
});
