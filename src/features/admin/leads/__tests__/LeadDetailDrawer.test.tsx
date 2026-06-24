import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvoiceRegistryRow } from '@/app/actions/invoices';
import { LeadDetailDrawer } from '../LeadDetailDrawer';

function lead(overrides: Partial<InvoiceRegistryRow> = {}): InvoiceRegistryRow {
    return {
        job_id: 'lead-1',
        agent_id: 'agent-1',
        franchise_id: 'franchise-1',
        created_at: '2026-06-01T10:00:00.000Z',
        ocr_status: 'completed',
        compared_at: '2026-06-01T10:05:00.000Z',
        drive_view_link: null,
        drive_synced_at: null,
        archived_in_drive: false,
        process_status: 'ocr_done',
        titular: 'Maria Lopez',
        comercializadora_actual: 'Actual',
        cups: 'ES0021000000000000AA1F',
        importe_total: '123.45',
        tarifa_actual: '2.0TD',
        closed: false,
        lost: false,
        lost_reason: null,
        compania_contratada: null,
        tarifa_contratada: null,
        permanencia_hasta: null,
        commission_amount: null,
        closed_at: null,
        agent_name: 'Comercial Uno',
        franchise_name: 'Franquicia Norte',
        period_days: null, annual_savings: null, savings_percent: null, has_proposal: false, reviewed_at: null,
        ...overrides,
    };
}

const handlers = {
    onClose: vi.fn(),
    onViewFile: vi.fn(),
    onConvert: vi.fn(),
    onLost: vi.fn(),
};

describe('LeadDetailDrawer', () => {
    it('renders operational details and timeline for an open lead', () => {
        render(<LeadDetailDrawer lead={lead()} {...handlers} />);

        expect(screen.getByRole('dialog', { name: /detalle del lead/i })).toBeTruthy();
        expect(screen.getAllByText('Maria Lopez').length).toBeGreaterThan(0);
        expect(screen.getByText('ES0021...AA1F')).toBeTruthy();
        expect(screen.getByText('Factura subida')).toBeTruthy();
        expect(screen.getByRole('button', { name: /pasar a cliente/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /marcar perdido/i })).toBeTruthy();
    });

    it('offers closure editing for won leads', () => {
        render(<LeadDetailDrawer lead={lead({
            closed: true,
            process_status: 'closed_won',
            compania_contratada: 'Nueva Energia',
            closed_at: '2026-06-01T11:00:00.000Z',
        })} {...handlers} />);

        expect(screen.getByRole('button', { name: /editar cierre/i })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /marcar perdido/i })).toBeNull();
    });

    it('offers lost reason editing for lost leads', () => {
        render(<LeadDetailDrawer lead={lead({
            lost: true,
            process_status: 'closed_lost',
            lost_reason: 'No contesta',
        })} {...handlers} />);

        expect(screen.getByRole('button', { name: /editar motivo/i })).toBeTruthy();
        expect(screen.getAllByText('No contesta').length).toBeGreaterThan(0);
    });

    it('renders persisted audit events and a labeled note form', () => {
        render(<LeadDetailDrawer
            lead={lead()}
            auditEvents={[{
                id: 'event-1',
                job_id: 'lead-1',
                actor_id: 'actor-1',
                event_type: 'note_added',
                title: 'Nota interna',
                detail: 'Cliente pide llamar el viernes',
                metadata: {},
                created_at: '2026-06-01T12:00:00.000Z',
                actor_name: 'Admin',
                actor_email: 'admin@example.com',
            }]}
            noteText=""
            noteSaving={false}
            onNoteTextChange={vi.fn()}
            onAddNote={vi.fn()}
            {...handlers}
        />);

        expect(screen.getByText('Auditoría real')).toBeTruthy();
        expect(screen.getByText('Cliente pide llamar el viernes')).toBeTruthy();
        expect(screen.getByLabelText(/nueva nota interna/i)).toBeTruthy();
        expect(screen.getByRole('button', { name: /añadir nota/i })).toBeTruthy();
    });
});
