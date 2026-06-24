import { describe, expect, it } from 'vitest';
import type { InvoiceRegistryRow } from '@/app/actions/invoices';
import { buildLeadTimeline, maskCups } from '../leadDetail';

function lead(overrides: Partial<InvoiceRegistryRow> = {}): InvoiceRegistryRow {
    return {
        job_id: 'lead-1',
        agent_id: 'agent-1',
        franchise_id: 'franchise-1',
        created_at: '2026-06-01T10:00:00.000Z',
        ocr_status: 'completed',
        compared_at: '2026-06-01T10:05:00.000Z',
        drive_view_link: 'https://drive.example/file',
        drive_synced_at: '2026-06-01T10:07:00.000Z',
        archived_in_drive: true,
        process_status: 'closed_won',
        titular: 'Maria Lopez',
        comercializadora_actual: 'Actual',
        cups: 'ES0021000000000000AA1F',
        importe_total: '123.45',
        tarifa_actual: '2.0TD',
        closed: true,
        lost: false,
        lost_reason: null,
        compania_contratada: 'Nueva Energia',
        tarifa_contratada: 'Plan fijo',
        permanencia_hasta: '2027-06-01',
        commission_amount: 125,
        closed_at: '2026-06-01T11:00:00.000Z',
        agent_name: 'Comercial Uno',
        franchise_name: 'Franquicia Norte',
        period_days: null, annual_savings: null, savings_percent: null, has_proposal: false, reviewed_at: null,
        ...overrides,
    };
}

describe('maskCups', () => {
    it('keeps only a readable prefix and suffix for sensitive CUPS values', () => {
        expect(maskCups('ES0021000000000000AA1F')).toBe('ES0021...AA1F');
    });

    it('returns an empty dash for missing values', () => {
        expect(maskCups(null)).toBe('—');
    });
});

describe('buildLeadTimeline', () => {
    it('builds the operational history for a won lead', () => {
        expect(buildLeadTimeline(lead()).map((item) => item.label)).toEqual([
            'Factura subida',
            'OCR completado',
            'Comparativa lista',
            'Archivada en Drive',
            'Cliente confirmado',
            'Permanencia registrada',
        ]);
    });

    it('marks pending Drive work and lost reason when the lead was not closed', () => {
        const items = buildLeadTimeline(lead({
            archived_in_drive: false,
            drive_view_link: null,
            drive_synced_at: null,
            closed: false,
            lost: true,
            process_status: 'closed_lost',
            closed_at: null,
            permanencia_hasta: null,
            lost_reason: 'No contesta',
        }));

        expect(items).toEqual(expect.arrayContaining([
            expect.objectContaining({ id: 'drive-pending', status: 'pending' }),
            expect.objectContaining({ id: 'lost', status: 'warning', detail: 'No contesta' }),
        ]));
    });
});
