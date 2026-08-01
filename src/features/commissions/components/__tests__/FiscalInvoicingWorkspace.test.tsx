import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { InvoicingWorkspaceData } from '@/app/actions/invoicing';
import { FiscalInvoicingWorkspace } from '../FiscalInvoicingWorkspace';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/app/actions/invoicing', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/app/actions/invoicing')>(),
    acceptSelfBilledInvoiceAction: vi.fn(),
    acceptSelfBillingAgreementAction: vi.fn(),
    cancelInvoiceAction: vi.fn(),
    generateInvoiceAction: vi.fn(),
    issueInvoiceAction: vi.fn(),
    markInvoicePaidAction: vi.fn(),
}));

const actorId = '11111111-1111-4111-8111-111111111111';

function workspace(overrides: Partial<InvoicingWorkspaceData> = {}): InvoicingWorkspaceData {
    return {
        actorId,
        role: 'agent',
        invoices: [],
        commissions: [],
        selfBillingAgreement: null,
        missingFiscalFields: [],
        stats: { total: 0, draft: 0, issued: 0, paid: 0, totalAmount: 0 },
        ...overrides,
    } as InvoicingWorkspaceData;
}

function invoice(overrides: Record<string, unknown> = {}) {
    return {
        id: '22222222-2222-4222-8222-222222222222',
        invoice_number: 'FAC-2026-00001',
        agent_id: actorId,
        issuer_name: 'Comercial Uno',
        issue_date: '2026-08-01',
        due_date: '2026-08-31',
        invoice_lines: [{ commission_id: 'c1' }],
        subtotal: 100,
        tax_base: 100,
        tax_amount: 21,
        retention_total: 0,
        retention_percent: 0,
        tax_type: 'IVA',
        tax_percent: 21,
        total: 121,
        status: 'draft',
        document_kind: 'collaborator_invoice',
        self_billing: false,
        acceptance_status: 'not_required',
        profiles: { full_name: 'Comercial Uno', email: 'comercial@example.test' },
        ...overrides,
    };
}

describe('FiscalInvoicingWorkspace', () => {
    it('shows only valid draft actions to the commercial owner', () => {
        render(<FiscalInvoicingWorkspace data={workspace({ invoices: [invoice()] } as Partial<InvoicingWorkspaceData>)} />);

        expect(screen.getByRole('button', { name: 'Emitir' })).toBeTruthy();
        expect(screen.getByTitle('Cancelar borrador')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Conciliar' })).toBeNull();
    });

    it('asks the commercial to accept each pending self-billed document', () => {
        render(<FiscalInvoicingWorkspace data={workspace({
            invoices: [invoice({ self_billing: true, acceptance_status: 'pending' })],
        } as Partial<InvoicingWorkspaceData>)} />);

        expect(screen.getByRole('button', { name: 'Aceptar' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Emitir' })).toBeNull();
    });

    it('reserves payment reconciliation for admin on issued invoices', () => {
        const issued = invoice({ status: 'issued' });
        const commercialRender = render(<FiscalInvoicingWorkspace data={workspace({ invoices: [issued] } as Partial<InvoicingWorkspaceData>)} />);
        expect(screen.queryByRole('button', { name: 'Conciliar' })).toBeNull();
        commercialRender.unmount();

        render(<FiscalInvoicingWorkspace data={workspace({ role: 'admin', invoices: [issued] } as Partial<InvoicingWorkspaceData>)} />);
        fireEvent.click(screen.getByRole('button', { name: 'Conciliar' }));
        expect(screen.getByRole('dialog', { name: 'Conciliar pago' })).toBeTruthy();
        const confirm = screen.getByRole('button', { name: 'Confirmar pago' }) as HTMLButtonElement;
        expect(confirm.disabled).toBe(true);
        fireEvent.change(screen.getByLabelText('Referencia bancaria'), { target: { value: 'TRX-001' } });
        expect(confirm.disabled).toBe(false);
    });

    it('blocks draft creation and links to settings when fiscal data is incomplete', () => {
        render(<FiscalInvoicingWorkspace data={workspace({
            missingFiscalFields: ['IVA', 'Verificación fiscal'],
        })} />);

        expect((screen.getByRole('button', { name: 'Crear borrador' }) as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByRole('link', { name: 'Completar datos fiscales' }).getAttribute('href')).toBe('/dashboard/settings');
    });
});
