import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvoiceRegistryRow } from '@/app/actions/invoices';
import { CloseInvoiceModal } from '../invoiceParts';

vi.mock('@/app/actions/invoices', () => ({
    closeInvoiceAction: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

function invoice(overrides: Partial<InvoiceRegistryRow> = {}): InvoiceRegistryRow {
    return {
        job_id: 'lead-1',
        agent_id: 'agent-1',
        franchise_id: null,
        created_at: '2026-06-01T10:00:00.000Z',
        ocr_status: 'completed',
        compared_at: null,
        drive_view_link: null,
        drive_synced_at: null,
        archived_in_drive: false,
        process_status: 'closed_won',
        titular: 'Maria Lopez',
        comercializadora_actual: 'Actual',
        cups: null,
        importe_total: null,
        tarifa_actual: '2.0TD',
        closed: true,
        lost: false,
        lost_reason: null,
        compania_contratada: 'Nueva Energia',
        tarifa_contratada: 'Plan fijo',
        permanencia_hasta: '2027-06-01',
        commission_amount: 125,
        closed_at: '2026-06-01T11:00:00.000Z',
        agent_name: 'Comercial',
        franchise_name: null,
        period_days: null, annual_savings: null, savings_percent: null, has_proposal: false, reviewed_at: null,
        ...overrides,
    };
}

describe('CloseInvoiceModal accessibility', () => {
    it('exposes named, labeled inputs for browser autofill and assistive tech', () => {
        render(<CloseInvoiceModal invoice={invoice()} onClose={vi.fn()} onClosed={vi.fn()} />);

        const company = screen.getByLabelText(/compañía contratada/i);
        const tariff = screen.getByLabelText(/^tarifa$/i);
        const permanence = screen.getByLabelText(/revisar el/i);
        const commission = screen.getByLabelText(/comisión del comercial/i);

        expect(company.getAttribute('name')).toBe('company');
        expect(company.getAttribute('autoComplete')).toBe('organization');
        expect(tariff.getAttribute('name')).toBe('tariff');
        expect(permanence.getAttribute('name')).toBe('permanenceUntil');
        expect(commission.getAttribute('name')).toBe('commission');
        expect(commission.getAttribute('inputMode')).toBe('decimal');
    });
});
