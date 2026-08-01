import { beforeEach, describe, expect, it, vi } from 'vitest';

const createServiceClientMock = vi.fn();
const encryptNullableMock = vi.fn((value: string) => `encrypted:${value}`);
const hashCupsMock = vi.fn((value: string) => `cups-hash:${value}`);
const hashDniMock = vi.fn((value: string) => `dni-hash:${value}`);

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));

vi.mock('@/lib/crypto/pii', () => ({
    encryptNullable: encryptNullableMock,
    hashCups: hashCupsMock,
    hashDni: hashDniMock,
    normalizeCups: (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
    normalizeDni: (value: string) => value.trim().toUpperCase().replace(/[^A-Z0-9]/g, ''),
}));

const completedInvoice = {
    client_name: 'Cliente prueba',
    cups: 'ES0021000000000000AA1F',
    dni_cif: 'B12345678',
    company_name: 'Comercializadora',
    tariff_name: '2.0TD',
    supply_address: 'Dirección de prueba',
    period_days: 30,
    total_amount: 121,
    power_p1: 4.6,
    power_p2: 4.6,
};

type RpcRow = {
    resolution: string;
    client_id: string;
    supply_point_id: string;
    opportunity_id: string;
    opportunity_stage: string;
    opportunity_created: boolean;
    opportunity_advanced: boolean;
};

type RpcResult = {
    data: RpcRow[] | null;
    error: { code: string; message: string } | null;
};

function createClient() {
    const updateEq = vi.fn(async () => ({ error: null }));
    const rpc = vi.fn(async (...args: unknown[]): Promise<RpcResult> => {
        void args;
        return {
            data: [{
                resolution: 'linked',
                client_id: '00000000-0000-4000-8000-000000000002',
                supply_point_id: '00000000-0000-4000-8000-000000000003',
                opportunity_id: '00000000-0000-4000-8000-000000000004',
                opportunity_stage: 'data_review',
                opportunity_created: true,
                opportunity_advanced: true,
            }],
            error: null,
        };
    });

    return {
        rpc,
        from: vi.fn(() => ({
            update: vi.fn(() => ({ eq: updateEq })),
        })),
    };
}

describe('reconcileCompletedOcrOpportunity', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        [{ ...completedInvoice, cups: '' }, 'missing_cups'],
        [{ ...completedInvoice, cups: 'incorrecto' }, 'invalid_cups'],
        [{ ...completedInvoice, client_name: 'Cliente Desconocido' }, 'missing_client_name'],
    ])('routes incomplete identity to manual review', async (invoice, reason) => {
        const client = createClient();
        createServiceClientMock.mockReturnValue(client);
        const { reconcileCompletedOcrOpportunity } = await import('../ocrOpportunity');

        const result = await reconcileCompletedOcrOpportunity(
            '00000000-0000-4000-8000-000000000001',
            invoice,
        );

        expect(result).toEqual({ status: 'manual_review', reason });
        expect(client.rpc).not.toHaveBeenCalled();
        expect(client.from).toHaveBeenCalledWith('ocr_jobs');
    });

    it('passes only protected identity values to the atomic RPC', async () => {
        const client = createClient();
        createServiceClientMock.mockReturnValue(client);
        const { reconcileCompletedOcrOpportunity } = await import('../ocrOpportunity');

        const result = await reconcileCompletedOcrOpportunity(
            '00000000-0000-4000-8000-000000000001',
            completedInvoice,
        );

        expect(result).toMatchObject({
            status: 'linked',
            opportunityId: '00000000-0000-4000-8000-000000000004',
            stage: 'data_review',
        });
        expect(client.rpc).toHaveBeenCalledWith(
            'reconcile_crm_ocr_opportunity',
            expect.objectContaining({
                p_job_id: '00000000-0000-4000-8000-000000000001',
                p_cups_ciphertext: 'encrypted:ES0021000000000000AA1F',
                p_cups_hash: 'cups-hash:ES0021000000000000AA1F',
                p_cups_last4: 'AA1F',
                p_dni_cif_ciphertext: 'encrypted:B12345678',
                p_dni_cif_hash: 'dni-hash:B12345678',
            }),
        );

        const rpcInput = client.rpc.mock.calls[0][1] as Record<string, unknown>;
        expect(rpcInput).not.toHaveProperty('p_cups');
        expect(rpcInput).not.toHaveProperty('p_dni_cif');
    });

    it('returns a safe persistence error without exposing database detail', async () => {
        const client = createClient();
        client.rpc.mockResolvedValueOnce({
            data: null,
            error: { code: 'XX000', message: 'sensitive database detail' },
        });
        createServiceClientMock.mockReturnValue(client);
        const { reconcileCompletedOcrOpportunity } = await import('../ocrOpportunity');

        await expect(reconcileCompletedOcrOpportunity(
            '00000000-0000-4000-8000-000000000001',
            completedInvoice,
        )).rejects.toThrow('No se pudo preparar el expediente comercial');
    });
});
