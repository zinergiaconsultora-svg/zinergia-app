import { describe, it, expect } from 'vitest';
import { scoreLead, sortByPriority, parseAmount } from '../priority';
import type { InvoiceRegistryRow } from '@/app/actions/invoices';

const NOW = new Date('2026-06-24T12:00:00Z').getTime();

function row(o: Partial<InvoiceRegistryRow> = {}): InvoiceRegistryRow {
    return {
        job_id: 'j', agent_id: 'a', franchise_id: null, created_at: new Date(NOW).toISOString(),
        ocr_status: 'completed', compared_at: null, drive_view_link: null, drive_synced_at: null,
        archived_in_drive: false, process_status: 'ocr_done', titular: 'Juan', comercializadora_actual: 'Endesa',
        cups: 'ES0021', importe_total: '60', tarifa_actual: '2.0TD', closed: false, lost: false, lost_reason: null,
        compania_contratada: null, tarifa_contratada: null, permanencia_hasta: null, commission_amount: null,
        closed_at: null, agent_name: 'Ana', franchise_name: null, period_days: '30',
        annual_savings: null, savings_percent: null, has_proposal: false, reviewed_at: null,
        ...o,
    };
}

describe('parseAmount', () => {
    it('parses comma and dot decimals', () => {
        expect(parseAmount('85,40')).toBeCloseTo(85.4);
        expect(parseAmount('85.40')).toBeCloseTo(85.4);
        expect(parseAmount(90)).toBe(90);
    });
    it('returns null for empty/invalid', () => {
        expect(parseAmount(null)).toBeNull();
        expect(parseAmount('')).toBeNull();
        expect(parseAmount('abc')).toBeNull();
    });
});

describe('scoreLead', () => {
    it('ranks a high-savings, compared, fresh lead as ALTA', () => {
        const p = scoreLead(row({ annual_savings: 520, process_status: 'compared', archived_in_drive: true, created_at: new Date(NOW).toISOString() }), NOW);
        expect(p.tier).toBe('alta');
        expect(p.savingsIsReal).toBe(true);
        expect(p.estimatedSavings).toBe(520);
        expect(p.reasons[0]).toContain('520');
    });

    it('estimates savings from the annualized bill when there is no proposal', () => {
        // 120 €/mes (period 30) → ~1460 €/año × 12% ≈ 175 €/año
        const p = scoreLead(row({ importe_total: '120', period_days: '30', annual_savings: null }), NOW);
        expect(p.savingsIsReal).toBe(false);
        expect(p.estimatedSavings).toBeGreaterThan(150);
        expect(p.reasons.some(r => r.includes('estimado'))).toBe(true);
    });

    it('flags a cooling lead and missing data, landing in BAJA', () => {
        const old = new Date(NOW - 8 * 86_400_000).toISOString();
        const p = scoreLead(row({ created_at: old, cups: null, archived_in_drive: false, importe_total: '30', process_status: 'uploaded' }), NOW);
        expect(p.reasons.some(r => r.includes('Enfriándose'))).toBe(true);
        expect(p.reasons).toContain('Falta CUPS');
        expect(p.tier).toBe('baja');
    });

    it('sends closed and lost leads to the bottom', () => {
        expect(scoreLead(row({ closed: true }), NOW)).toMatchObject({ tier: 'baja', score: 0, reasons: ['Ya es cliente'] });
        expect(scoreLead(row({ lost: true }), NOW)).toMatchObject({ tier: 'baja', score: 0, reasons: ['Lead perdido'] });
    });

    it('keeps the score within 0–100', () => {
        const p = scoreLead(row({ annual_savings: 9999, process_status: 'compared', has_proposal: true, archived_in_drive: true }), NOW);
        expect(p.score).toBeLessThanOrEqual(100);
        expect(p.score).toBeGreaterThanOrEqual(0);
    });
});

describe('sortByPriority', () => {
    it('orders high priority first', () => {
        const hot = row({ job_id: 'hot', annual_savings: 600, process_status: 'compared', archived_in_drive: true });
        const cold = row({ job_id: 'cold', importe_total: '20', cups: null, created_at: new Date(NOW - 40 * 86_400_000).toISOString() });
        const sorted = sortByPriority([cold, hot], NOW);
        expect(sorted[0].job_id).toBe('hot');
        expect(sorted[1].job_id).toBe('cold');
    });
});
