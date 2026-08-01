import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    requireServerRoleMock,
    createClientMock,
    createServiceClientMock,
    revalidatePathMock,
} = vi.hoisted(() => ({
    requireServerRoleMock: vi.fn(),
    createClientMock: vi.fn(),
    createServiceClientMock: vi.fn(),
    revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

import {
    configureFiscalOrganizationAction,
    createFiscalInvoiceDraftAction,
    generateInvoiceAction,
    markInvoicePaidAction,
    updateFiscalProfileAction,
} from '../invoicing';

const actorId = '11111111-1111-4111-8111-111111111111';
const commissionId = '22222222-2222-4222-8222-222222222222';
const invoiceId = '33333333-3333-4333-8333-333333333333';

function authenticatedClient() {
    return {
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actorId } } }) },
    };
}

describe('fiscal invoicing actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createClientMock.mockResolvedValue(authenticatedClient());
    });

    it('authorizes before constructing a service-role client', async () => {
        requireServerRoleMock.mockRejectedValue(new Error('Forbidden'));

        await expect(createFiscalInvoiceDraftAction({
            commercialId: actorId,
            commissionIds: [commissionId],
        })).rejects.toThrow('Forbidden');

        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('delegates draft creation atomically with the authenticated actor', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: invoiceId, error: null });
        createServiceClientMock.mockReturnValue({ rpc });

        const result = await createFiscalInvoiceDraftAction({
            commercialId: actorId,
            commissionIds: [commissionId],
        });

        expect(result).toEqual({ success: true, invoiceId });
        expect(rpc).toHaveBeenCalledWith('create_commission_invoice_draft', {
            p_commercial_id: actorId,
            p_commission_ids: [commissionId],
            p_actor_id: actorId,
        });
    });

    it('rejects malformed legacy form selections without calling the database', async () => {
        const formData = new FormData();
        formData.set('commission_ids', '{not-json');

        const result = await generateInvoiceAction(formData);

        expect(result).toEqual({ success: false, error: 'Selección de comisiones no válida.' });
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('requires admin role and records payment through the transition RPC', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: 'paid', error: null });
        createServiceClientMock.mockReturnValue({ rpc });

        const result = await markInvoicePaidAction(
            invoiceId,
            'transferencia',
            'TRX-2026-001',
            'Transferencia conciliada',
        );

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin']);
        expect(result).toEqual({ success: true });
        expect(rpc).toHaveBeenCalledWith('transition_fiscal_invoice', expect.objectContaining({
            p_invoice_id: invoiceId,
            p_to_status: 'paid',
            p_actor_id: actorId,
            p_payment_method: 'transferencia',
            p_payment_reference: 'TRX-2026-001',
        }));
    });

    it('stores tax and retention inputs server-side and resets verification', async () => {
        const eq = vi.fn().mockResolvedValue({ error: null });
        const update = vi.fn().mockReturnValue({ eq });
        createServiceClientMock.mockReturnValue({ from: vi.fn().mockReturnValue({ update }) });
        const formData = new FormData();
        Object.entries({
            nif_cif: 'B12345678',
            fiscal_address: 'Calle Mayor 1',
            fiscal_city: 'Madrid',
            fiscal_province: 'Madrid',
            fiscal_postal_code: '28001',
            fiscal_country: 'España',
            iban: 'ES9121000418450200051332',
            company_name: 'Consultor Uno SL',
            company_type: 'sociedad_limitada',
            retention_percent: '0',
            invoice_tax_percent: '21',
            invoice_prefix: 'FAC',
        }).forEach(([key, value]) => formData.set(key, value));

        const result = await updateFiscalProfileAction(formData);

        expect(result).toEqual({ success: true });
        expect(update).toHaveBeenCalledWith(expect.objectContaining({
            invoice_tax_percent: 21,
            retention_percent: 0,
            fiscal_verified: false,
            fiscal_verified_at: null,
        }));
        expect(eq).toHaveBeenCalledWith('id', actorId);
    });

    it('configures the real central fiscal entity only through an admin RPC', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: invoiceId, error: null });
        createServiceClientMock.mockReturnValue({ rpc });

        const result = await configureFiscalOrganizationAction({
            legalName: 'Zinergia Consultoría SL',
            nif: 'B12345678',
            fiscalAddress: 'Calle Mayor 1',
            fiscalCity: 'Madrid',
            fiscalPostalCode: '28001',
            fiscalCountry: 'España',
        });

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin']);
        expect(result).toEqual({ success: true });
        expect(rpc).toHaveBeenCalledWith('configure_fiscal_organization', expect.objectContaining({
            p_actor_id: actorId,
            p_legal_name: 'Zinergia Consultoría SL',
            p_nif: 'B12345678',
        }));
    });
});
