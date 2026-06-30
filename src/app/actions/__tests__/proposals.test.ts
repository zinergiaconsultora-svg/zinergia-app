import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Proposal } from '@/types/crm';

const createClientMock = vi.fn();
const revalidatePathMock = vi.fn();
const requireServerRoleMock = vi.fn();
const getActiveCommissionRuleMock = vi.fn();
const createNotificationInternalMock = vi.fn();
const writeLeadAuditEventMock = vi.fn();
const syncClientStatusFromLeadsMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathMock,
}));

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
}));

vi.mock('../commissionRules', () => ({
    getActiveCommissionRule: getActiveCommissionRuleMock,
}));

vi.mock('../notifications', () => ({
    createNotificationInternal: createNotificationInternalMock,
}));

vi.mock('@/lib/audit/leadAuditLog', () => ({
    writeLeadAuditEvent: writeLeadAuditEventMock,
}));

vi.mock('@/lib/crm/syncClientStatus', () => ({
    syncClientStatusFromLeads: syncClientStatusFromLeadsMock,
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: {
        warn: loggerWarnMock,
        error: loggerErrorMock,
    },
}));

function query(result: unknown = { data: null, error: null }) {
    const q = {
        select: vi.fn(() => q),
        update: vi.fn(() => q),
        insert: vi.fn(async () => result),
        upsert: vi.fn(async () => result),
        eq: vi.fn(() => q),
        in: vi.fn(() => q),
        order: vi.fn(() => q),
        limit: vi.fn(() => q),
        maybeSingle: vi.fn(async () => result),
        single: vi.fn(async () => result),
        then: vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
    };
    return q;
}

const acceptedProposal: Proposal = {
    id: 'proposal-1',
    client_id: 'client-1',
    franchise_id: 'franchise-1',
    agent_id: 'agent-1',
    created_at: '2026-06-30T10:00:00.000Z',
    updated_at: '2026-06-30T10:01:00.000Z',
    status: 'accepted',
    offer_snapshot: {
        id: 'tariff-1',
        marketer_name: 'Zinergia Test',
        tariff_name: 'Plan Test',
        logo_color: 'bg-blue-600',
        type: 'fixed',
        power_price: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
        energy_price: { p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0 },
        estimated_agent_commission: 120,
        contract_duration: '12 meses',
    },
    calculation_data: {
        client_name: 'Cliente Test',
        period_days: 30,
        power_p1: 1,
        power_p2: 1,
        power_p3: 0,
        power_p4: 0,
        power_p5: 0,
        power_p6: 0,
        energy_p1: 100,
        energy_p2: 0,
        energy_p3: 0,
        energy_p4: 0,
        energy_p5: 0,
        energy_p6: 0,
    },
    current_annual_cost: 1000,
    offer_annual_cost: 800,
    annual_savings: 200,
    savings_percent: 20,
};

describe('proposal status side effects', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        getActiveCommissionRuleMock.mockResolvedValue({
            commission_rate: 0.15,
            agent_share: 0.3,
            franchise_share: 0.5,
            hq_share: 0.2,
            points_per_win: 50,
        });
        createNotificationInternalMock.mockResolvedValue(undefined);
        writeLeadAuditEventMock.mockResolvedValue(undefined);
        syncClientStatusFromLeadsMock.mockResolvedValue(undefined);
    });

    it('creates accepted follow-up tasks only once when an authenticated proposal is accepted', async () => {
        const auth = { getUser: vi.fn(async () => ({ data: { user: { id: 'agent-1' } } })) };
        const profileQueries = [
            query({ data: { role: 'agent', franchise_id: 'franchise-1' }, error: null }),
            query({ data: { franchise_id: 'franchise-1' }, error: null }),
            query({ data: null, error: null }),
            query({ data: [{ id: 'franchise-profile-1', role: 'franchise' }], error: null }),
        ];
        const proposalUpdate = query({ data: acceptedProposal, error: null });
        const existingCommission = query({ data: null, error: null });
        const franchiseConfig = query({ data: { royalty_percent: null }, error: null });
        const currentPoints = query({ data: { points: 10 }, error: null });
        const openJob = query({ data: null, error: null });
        const existingContract = query({ data: null, error: null });
        const tasksInsert = query({ error: null });

        const from = vi.fn((table: string) => {
            if (table === 'profiles') return profileQueries.shift() ?? query({ data: null, error: null });
            if (table === 'proposals') return proposalUpdate;
            if (table === 'network_commissions') return existingCommission;
            if (table === 'franchise_config') return franchiseConfig;
            if (table === 'user_points') return currentPoints;
            if (table === 'ocr_jobs') return openJob;
            if (table === 'tasks') return tasksInsert;
            if (table === 'contracts') return existingContract;
            return query({ error: null });
        });

        createClientMock.mockResolvedValue({ auth, from });

        const { updateProposalStatusAction } = await import('../proposals');

        await updateProposalStatusAction('proposal-1', 'accepted');

        expect(existingCommission.upsert).toHaveBeenCalledWith(expect.objectContaining({
            proposal_id: 'proposal-1',
            agent_id: 'agent-1',
            franchise_id: 'franchise-profile-1',
            status: 'pending',
        }), { onConflict: 'proposal_id', ignoreDuplicates: true });
        expect(tasksInsert.insert).toHaveBeenCalledTimes(1);
        expect(tasksInsert.insert).toHaveBeenCalledWith([
            expect.objectContaining({
                proposal_id: 'proposal-1',
                title: 'Recopilar documentación',
                type: 'documentation',
                auto_generated: true,
            }),
        ]);
    });
});
