import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireServerRoleMock = vi.fn();
const getUserRoleMock = vi.fn();
const createClientMock = vi.fn();
const createServiceClientMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
    getUserRole: getUserRoleMock,
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));
vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

function createQuery(data: unknown[] = []) {
    const query = {
        eq: vi.fn(),
        in: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
    };

    query.eq.mockReturnValue(query);
    query.in.mockReturnValue(query);
    query.order.mockReturnValue(query);
    query.range.mockResolvedValue({ data, error: null });

    return query;
}

describe('getOpportunityWorkQueueAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        getUserRoleMock.mockResolvedValue('agent');
    });

    it('authorizes before creating the query client', async () => {
        requireServerRoleMock.mockRejectedValue(new Error('Forbidden'));
        const { getOpportunityWorkQueueAction } = await import('../workQueue');

        await expect(getOpportunityWorkQueueAction()).rejects.toThrow('Forbidden');
        expect(createClientMock).not.toHaveBeenCalled();
    });

    it('always limits an agent query to the authenticated owner', async () => {
        const query = createQuery();
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: { id: '00000000-0000-4000-8000-000000000001' } },
                })),
            },
            from: vi.fn(() => ({
                select: vi.fn(() => query),
            })),
        });
        const { getOpportunityWorkQueueAction } = await import('../workQueue');

        await getOpportunityWorkQueueAction({
            ownerId: '00000000-0000-4000-8000-000000000002',
            dueGroup: 'today',
        });

        expect(query.eq).toHaveBeenCalledWith(
            'owner_id',
            '00000000-0000-4000-8000-000000000001',
        );
        expect(query.eq).toHaveBeenCalledWith('due_group', 'today');
    });

    it('allows an admin to narrow the RLS-visible queue by owner and stage', async () => {
        const query = createQuery();
        getUserRoleMock.mockResolvedValue('admin');
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: { id: '00000000-0000-4000-8000-000000000010' } },
                })),
            },
            from: vi.fn(() => ({
                select: vi.fn(() => query),
            })),
        });
        const { getOpportunityWorkQueueAction } = await import('../workQueue');

        await getOpportunityWorkQueueAction({
            ownerId: '00000000-0000-4000-8000-000000000002',
            stages: ['data_review', 'proposal_sent'],
        });

        expect(query.eq).toHaveBeenCalledWith(
            'owner_id',
            '00000000-0000-4000-8000-000000000002',
        );
        expect(query.in).toHaveBeenCalledWith(
            'stage',
            ['data_review', 'proposal_sent'],
        );
    });

    it('validates permanence before opening a database session', async () => {
        const { confirmContractPermanenceAction } = await import('../workQueue');

        const result = await confirmContractPermanenceAction({
            contractId: '11111111-1111-4111-8111-111111111111',
            permanenceStatus: 'known',
            endDate: null,
        });

        expect(result).toEqual({ ok: false, error: 'Indica la fecha de vencimiento.' });
        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise', 'agent']);
        expect(createClientMock).not.toHaveBeenCalled();
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('confirms permanence through protected workflows and refreshes the client', async () => {
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: { id: '22222222-2222-4222-8222-222222222222' } },
                })),
            },
        });
        const rpc = vi.fn()
            .mockResolvedValueOnce({
                data: { client_id: '33333333-3333-4333-8333-333333333333' },
                error: null,
            })
            .mockResolvedValueOnce({ data: [], error: null });
        createServiceClientMock.mockReturnValue({ rpc });
        const { confirmContractPermanenceAction } = await import('../workQueue');

        const result = await confirmContractPermanenceAction({
            contractId: '11111111-1111-4111-8111-111111111111',
            permanenceStatus: 'known',
            endDate: '2026-09-01',
        });

        expect(result).toEqual({ ok: true });
        expect(rpc).toHaveBeenNthCalledWith(1, 'confirm_contract_permanence', {
            p_contract_id: '11111111-1111-4111-8111-111111111111',
            p_actor_id: '22222222-2222-4222-8222-222222222222',
            p_permanence_status: 'known',
            p_end_date: '2026-09-01',
        });
        expect(rpc).toHaveBeenNthCalledWith(2, 'reconcile_contract_renewals', {
            p_as_of: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        });
        expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard/clients/33333333-3333-4333-8333-333333333333');
    });
});
