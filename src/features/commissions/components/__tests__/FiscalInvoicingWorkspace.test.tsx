import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
    acceptSelfBilledInvoiceAction,
    acceptSelfBillingAgreementAction,
    cancelInvoiceAction,
    generateInvoiceAction,
    issueInvoiceAction,
    markInvoicePaidAction,
    type InvoicingWorkspaceData,
} from '@/app/actions/invoicing';
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

    it('creates a draft from selected commissions and supports closing the selector', async () => {
        vi.mocked(generateInvoiceAction).mockResolvedValue({
            success: true,
            invoiceId: '99999999-9999-4999-8999-999999999999',
        });
        const commission = {
            id: '33333333-3333-4333-8333-333333333333',
            agent_commission: 125,
            proposals: [{ clients: [{ name: 'Taller Norte' }] }],
        };

        render(<FiscalInvoicingWorkspace data={workspace({
            commissions: [commission],
        } as unknown as Partial<InvoicingWorkspaceData>)} />);

        fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }));
        expect(screen.getByText('Taller Norte')).toBeTruthy();
        fireEvent.click(screen.getByTitle('Cerrar'));
        fireEvent.click(screen.getByRole('button', { name: 'Crear borrador' }));
        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getAllByRole('button', { name: 'Crear borrador' })[1]);

        await waitFor(() => expect(generateInvoiceAction).toHaveBeenCalled());
        const formData = vi.mocked(generateInvoiceAction).mock.calls.at(-1)?.[0] as FormData;
        expect(formData.get('commission_ids')).toBe(JSON.stringify([commission.id]));
    });

    it('executes every valid invoice action and accepts the self-billing agreement', async () => {
        vi.mocked(acceptSelfBilledInvoiceAction).mockResolvedValue({ success: true });
        vi.mocked(issueInvoiceAction).mockResolvedValue({ success: true });
        vi.mocked(cancelInvoiceAction).mockResolvedValue({ success: true });
        vi.mocked(acceptSelfBillingAgreementAction).mockResolvedValue({ success: true });

        const pendingSelfBill = invoice({
            id: '44444444-4444-4444-8444-444444444444',
            invoice_number: 'AUTO-1',
            self_billing: true,
            acceptance_status: 'pending',
        });
        const ownerDraft = invoice({
            id: '55555555-5555-4555-8555-555555555555',
            invoice_number: 'FAC-2',
        });

        render(<FiscalInvoicingWorkspace data={workspace({
            invoices: [pendingSelfBill, ownerDraft],
            selfBillingAgreement: {
                id: '66666666-6666-4666-8666-666666666666',
                reference: 'AUTO-2026-001',
                acceptedAt: null,
            },
        } as unknown as Partial<InvoicingWorkspaceData>)} />);

        fireEvent.click(screen.getByRole('button', { name: 'Aceptar acuerdo' }));
        await waitFor(() => expect(acceptSelfBillingAgreementAction).toHaveBeenCalledWith(
            '66666666-6666-4666-8666-666666666666',
        ));

        fireEvent.click(await screen.findByRole('button', { name: 'Aceptar' }));
        await waitFor(() => expect(acceptSelfBilledInvoiceAction).toHaveBeenCalledWith(pendingSelfBill.id));

        fireEvent.click(await screen.findByRole('button', { name: 'Emitir' }));
        await waitFor(() => expect(issueInvoiceAction).toHaveBeenCalledWith(ownerDraft.id));

        fireEvent.click(await screen.findByTitle('Cancelar borrador'));
        await waitFor(() => expect(cancelInvoiceAction).toHaveBeenCalledWith(ownerDraft.id));
    });

    it('filters invoices and reconciles a payment with a bank reference', async () => {
        vi.mocked(markInvoicePaidAction).mockResolvedValue({ success: true });
        const issued = invoice({
            id: '77777777-7777-4777-8777-777777777777',
            status: 'issued',
        });
        const paid = invoice({
            id: '88888888-8888-4888-8888-888888888888',
            invoice_number: 'FAC-PAID',
            status: 'paid',
        });

        render(<FiscalInvoicingWorkspace data={workspace({
            role: 'admin',
            invoices: [issued, paid],
        } as Partial<InvoicingWorkspaceData>)} />);

        fireEvent.click(screen.getByRole('tab', { name: 'Pagada' }));
        expect(screen.getByText('FAC-PAID')).toBeTruthy();
        expect(screen.queryByText('FAC-2026-00001')).toBeNull();
        fireEvent.click(screen.getByRole('tab', { name: 'Todas' }));

        fireEvent.click(screen.getByRole('button', { name: 'Conciliar' }));
        fireEvent.click(screen.getByTitle('Cerrar'));
        fireEvent.click(screen.getByRole('button', { name: 'Conciliar' }));
        fireEvent.change(screen.getByLabelText('Referencia bancaria'), { target: { value: ' TRX-900 ' } });
        fireEvent.click(screen.getByRole('button', { name: 'Confirmar pago' }));

        await waitFor(() => expect(markInvoicePaidAction).toHaveBeenCalledWith(
            issued.id,
            'transferencia',
            'TRX-900',
        ));
    });
});
