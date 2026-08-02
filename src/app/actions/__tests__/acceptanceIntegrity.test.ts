import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireServerRoleMock = vi.fn();
const createClientMock = vi.fn();
const serviceRpcMock = vi.fn();
const serviceFromMock = vi.fn();
const reconcileEffectsMock = vi.fn();

vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: vi.fn(() => ({ rpc: serviceRpcMock, from: serviceFromMock })),
}));
vi.mock('../proposals', () => ({ reconcileAcceptedProposalDurableEffects: reconcileEffectsMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

function query(result: unknown) {
    const q = {
        select: vi.fn(() => q),
        order: vi.fn(() => q),
        eq: vi.fn(() => q),
        maybeSingle: vi.fn(async () => result),
        then: vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
    };
    return q;
}

const integrityRow = {
    proposal_id: '11111111-1111-4111-8111-111111111111',
    opportunity_id: '22222222-2222-4222-8222-222222222222',
    owner_id: 'agent-1',
    accepted_at: '2026-07-31T10:00:00Z',
    opportunity_stage: 'accepted',
    missing_opportunity: false,
    missing_activation: true,
    missing_commission: true,
    missing_contract: true,
    issue_count: 3,
};

describe('acceptance integrity actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        reconcileEffectsMock.mockResolvedValue(undefined);
    });

    it('returns a safe admin reconciliation queue', async () => {
        const queue = query({ data: [integrityRow], error: null });
        createClientMock.mockResolvedValue({ from: vi.fn(() => queue) });
        const { getAcceptanceIntegrityItemsAction } = await import('../acceptanceIntegrity');

        const items = await getAcceptanceIntegrityItemsAction();

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin']);
        expect(items).toEqual([expect.objectContaining({
            proposalId: integrityRow.proposal_id,
            missingActivation: true,
            missingCommission: true,
            missingContract: true,
        })]);
        const selected = (queue.select.mock.calls as unknown as Array<[string]>)[0][0];
        expect(selected).not.toMatch(/name|email|phone|cups|dni|token|signature/i);
    });

    it('repairs state first and retries only the missing durable effects', async () => {
        const before = query({ data: integrityRow, error: null });
        const after = query({ data: null, error: null });
        const sessionFrom = vi.fn()
            .mockReturnValueOnce(before)
            .mockReturnValueOnce(after);
        createClientMock.mockResolvedValue({
            auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })) },
            from: sessionFrom,
        });
        serviceRpcMock.mockResolvedValue({ data: [{}], error: null });
        const proposal = query({ data: {
            id: integrityRow.proposal_id,
            client_id: 'client-1',
            opportunity_id: integrityRow.opportunity_id,
            supply_point_id: 'supply-1',
            agent_id: 'agent-1',
            status: 'accepted',
        }, error: null });
        serviceFromMock.mockReturnValue(proposal);
        const { retryAcceptanceIntegrityAction } = await import('../acceptanceIntegrity');

        const result = await retryAcceptanceIntegrityAction(integrityRow.proposal_id);

        expect(serviceRpcMock).toHaveBeenCalledWith('reconcile_crm_acceptance_state', {
            p_proposal_id: integrityRow.proposal_id,
            p_actor_id: 'admin-1',
        });
        expect(reconcileEffectsMock).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
            agent_id: 'agent-1',
            opportunity_id: integrityRow.opportunity_id,
        }), { commission: true, contract: true });
        expect(result).toEqual({ ok: true, remaining: null });
    });

    it('does not guess an opportunity for an ambiguous legacy proposal', async () => {
        const before = query({ data: { ...integrityRow, opportunity_id: null, missing_opportunity: true }, error: null });
        createClientMock.mockResolvedValue({
            auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })) },
            from: vi.fn(() => before),
        });
        const { retryAcceptanceIntegrityAction } = await import('../acceptanceIntegrity');

        const result = await retryAcceptanceIntegrityAction(integrityRow.proposal_id);

        expect(result.ok).toBe(false);
        expect(serviceRpcMock).not.toHaveBeenCalled();
        expect(reconcileEffectsMock).not.toHaveBeenCalled();
    });
});
