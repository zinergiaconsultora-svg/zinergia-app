import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { InvoiceData, SavingsResult } from '@/types/crm';

const getFranchiseIdMock = vi.fn();
const invalidateCacheByPrefixMock = vi.fn();
const resolveOrCreateClientActionMock = vi.fn();
const logActivityMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
const fromMock = vi.fn();
const getUserMock = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
    createClient: vi.fn(() => ({
        auth: { getUser: getUserMock },
        from: fromMock,
    })),
}));

vi.mock('../shared', () => ({
    getFranchiseId: getFranchiseIdMock,
    invalidateCacheByPrefix: invalidateCacheByPrefixMock,
}));

vi.mock('@/app/actions/clients', () => ({
    resolveOrCreateClientAction: resolveOrCreateClientActionMock,
}));

vi.mock('../activities', () => ({
    activitiesService: {
        logActivity: logActivityMock,
    },
}));

vi.mock('@/app/actions/proposals', () => ({
    updateProposalStatusAction: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        warn: loggerWarnMock,
        error: loggerErrorMock,
    },
}));

function insertSelectSingle(result: unknown) {
    const query = {
        insert: vi.fn(() => query),
        select: vi.fn(() => query),
        single: vi.fn(async () => result),
    };
    return query;
}

function updateEq(result: unknown) {
    const query = {
        update: vi.fn(() => query),
        eq: vi.fn(async () => result),
    };
    return query;
}

const invoiceData: InvoiceData = {
    client_name: 'Cliente Demo',
    cups: 'ES0021000000000000XX',
    dni_cif: 'B12345678',
    company_name: 'Comercializadora Actual',
    period_days: 30,
    power_p1: 4.6,
    power_p2: 4.6,
    power_p3: 0,
    power_p4: 0,
    power_p5: 0,
    power_p6: 0,
    energy_p1: 120,
    energy_p2: 80,
    energy_p3: 0,
    energy_p4: 0,
    energy_p5: 0,
    energy_p6: 0,
};

const bestResult: SavingsResult = {
    offer: {
        id: '11111111-1111-4111-8111-111111111111',
        tariff_id: '11111111-1111-4111-8111-111111111111',
        marketer_name: 'Nueva Energia',
        tariff_name: 'Plan Fijo',
        type: 'fixed',
        logo_color: 'bg-blue-600',
        contract_duration: '12 meses',
        power_price: { p1: 1, p2: 1, p3: 0, p4: 0, p5: 0, p6: 0 },
        energy_price: { p1: 0.1, p2: 0.08, p3: 0, p4: 0, p5: 0, p6: 0 },
    },
    current_annual_cost: 1200,
    offer_annual_cost: 900,
    annual_savings: 300,
    savings_percent: 25,
    calculation_audit: ({
        current_cost: 1200,
        new_cost: 900,
        savings: 300,
    } as unknown) as SavingsResult['calculation_audit'],
};

describe('proposalService.logSimulation OCR provenance', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        getFranchiseIdMock.mockResolvedValue('franchise-1');
        getUserMock.mockResolvedValue({ data: { user: { id: 'agent-1' } } });
        resolveOrCreateClientActionMock.mockResolvedValue('client-1');
        logActivityMock.mockResolvedValue(undefined);
    });

    it('persists a real OCR job id on simulator proposals and links the OCR job to the client', async () => {
        const proposalInsert = insertSelectSingle({
            data: { id: 'proposal-1', client_id: 'client-1' },
            error: null,
        });
        const ocrUpdate = updateEq({ error: null });
        fromMock.mockImplementation((table: string) => {
            if (table === 'proposals') return proposalInsert;
            if (table === 'ocr_jobs') return ocrUpdate;
            throw new Error(`Unexpected table ${table}`);
        });
        const { proposalService } = await import('../proposals');
        const ocrJobId = '22222222-2222-4222-8222-222222222222';

        await proposalService.logSimulation(invoiceData, bestResult, 'Cliente Demo', undefined, ocrJobId);

        expect(proposalInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
            client_id: 'client-1',
            franchise_id: 'franchise-1',
            agent_id: 'agent-1',
            ocr_job_id: ocrJobId,
            status: 'draft',
            price_snapshot: expect.any(Object),
            price_snapshot_at: expect.any(String),
            pricing_status: 'current',
            proposal_version: 1,
        }));
        expect(ocrUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
            client_id: 'client-1',
            compared_at: expect.any(String),
        }));
        expect(ocrUpdate.eq).toHaveBeenCalledWith('id', ocrJobId);
    });

    it('does not persist or link mock OCR job ids', async () => {
        const proposalInsert = insertSelectSingle({
            data: { id: 'proposal-1', client_id: 'client-1' },
            error: null,
        });
        fromMock.mockImplementation((table: string) => {
            if (table === 'proposals') return proposalInsert;
            throw new Error(`Unexpected table ${table}`);
        });
        const { proposalService } = await import('../proposals');

        await proposalService.logSimulation(invoiceData, bestResult, 'Cliente Demo', undefined, 'MOCK-JOB');

        expect(proposalInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
            ocr_job_id: null,
        }));
        expect(fromMock).not.toHaveBeenCalledWith('ocr_jobs');
    });
});
