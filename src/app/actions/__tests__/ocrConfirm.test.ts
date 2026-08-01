import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvoiceData } from '@/types/crm';

const requireServerRoleMock = vi.fn();
const createServerClientMock = vi.fn();
const createServiceClientMock = vi.fn();

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: createServerClientMock,
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));

vi.mock('@/lib/ocr/sanitizeTrainingData', () => ({
    sanitizeOcrTrainingData: (value: unknown) => value,
}));

const correctedData: InvoiceData = {
    period_days: 30,
    power_p1: 4.6,
    power_p2: 4.6,
    power_p3: 0,
    power_p4: 0,
    power_p5: 0,
    power_p6: 0,
    energy_p1: 100,
    energy_p2: 80,
    energy_p3: 60,
    energy_p4: 0,
    energy_p5: 0,
    energy_p6: 0,
    client_name: 'Cliente prueba',
    cups: 'ES0021000000000000AA1F',
    company_name: 'Comercializadora',
};

describe('confirmOcrExtractionAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createServerClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({
                    data: {
                        user: { id: '00000000-0000-4000-8000-000000000001' },
                    },
                })),
            },
        });
    });

    it('authorizes before creating a session or service client', async () => {
        requireServerRoleMock.mockRejectedValue(new Error('Forbidden'));
        const { confirmOcrExtractionAction } = await import('../ocr-confirm');

        await expect(confirmOcrExtractionAction(
            '00000000-0000-4000-8000-000000000002',
            correctedData,
        )).rejects.toThrow('Forbidden');

        expect(createServerClientMock).not.toHaveBeenCalled();
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('confirms the linked job atomically before updating training memory', async () => {
        const rpc = vi.fn(async () => ({
            data: {
                id: '00000000-0000-4000-8000-000000000003',
                stage: 'proposal_preparation',
            },
            error: null,
        }));
        const maybeSingle = vi.fn(async () => ({
            data: {
                id: '00000000-0000-4000-8000-000000000004',
                extracted_fields: correctedData,
                is_validated: false,
            },
            error: null,
        }));
        const updateEq = vi.fn(async () => ({ error: null }));
        createServiceClientMock.mockReturnValue({
            rpc,
            from: vi.fn(() => ({
                select: vi.fn(() => ({
                    eq: vi.fn(() => ({ maybeSingle })),
                })),
                update: vi.fn(() => ({ eq: updateEq })),
            })),
        });
        const { confirmOcrExtractionAction } = await import('../ocr-confirm');

        await expect(confirmOcrExtractionAction(
            '00000000-0000-4000-8000-000000000002',
            correctedData,
        )).resolves.toEqual({
            correctedFieldsCount: 0,
            alreadyValidated: false,
        });

        expect(rpc).toHaveBeenCalledWith('confirm_crm_ocr_data', {
            p_job_id: '00000000-0000-4000-8000-000000000002',
            p_actor_id: '00000000-0000-4000-8000-000000000001',
            p_corrected_data: correctedData,
        });
        expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
            maybeSingle.mock.invocationCallOrder[0],
        );
    });

    it('returns a safe error and does not touch training memory when confirmation fails', async () => {
        const from = vi.fn();
        createServiceClientMock.mockReturnValue({
            rpc: vi.fn(async () => ({
                data: null,
                error: { code: '42501', message: 'raw database detail' },
            })),
            from,
        });
        const { confirmOcrExtractionAction } = await import('../ocr-confirm');

        await expect(confirmOcrExtractionAction(
            '00000000-0000-4000-8000-000000000002',
            correctedData,
        )).rejects.toThrow('No se pudieron confirmar los datos OCR');
        expect(from).not.toHaveBeenCalled();
    });
});
