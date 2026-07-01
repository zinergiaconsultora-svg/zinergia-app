import { beforeEach, describe, expect, it, vi } from 'vitest';

const createClientMock = vi.fn();
const createServiceClientMock = vi.fn();
const requireServerRoleMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
}));

vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathMock,
}));

function query(result: unknown = { data: null, error: null }) {
    const q = {
        select: vi.fn(() => q),
        update: vi.fn(() => q),
        insert: vi.fn(async () => result),
        eq: vi.fn(() => q),
        in: vi.fn(() => q),
        single: vi.fn(async () => result),
        then: vi.fn((resolve, reject) => Promise.resolve(result).then(resolve, reject)),
    };
    return q;
}

describe('alta admin actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createServiceClientMock.mockReturnValue({
            from: vi.fn(() => query({ data: null, error: null })),
        });
    });

    it('does not request alta for a non-accepted proposal even if alta_status drifted to lista_admin', async () => {
        const auth = { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })) };
        const proposalRead = query({
            data: {
                status: 'sent',
                alta_status: 'lista_admin',
                consent_confirmed_at: '2026-07-01T10:00:00.000Z',
            },
            error: null,
        });
        const proposalUpdate = query({ data: [{ id: 'proposal-1' }], error: null });
        const from = vi.fn((table: string) => {
            if (table === 'proposals') {
                return {
                    select: proposalRead.select,
                    update: proposalUpdate.update,
                };
            }
            return query({ data: null, error: null });
        });
        createClientMock.mockResolvedValue({ auth, from });

        const { requestAlta } = await import('../alta');

        const result = await requestAlta('proposal-1');

        expect(result).toEqual({
            ok: false,
            error: 'Solo se puede solicitar el alta de una propuesta aceptada.',
        });
        expect(proposalUpdate.update).not.toHaveBeenCalled();
        expect(createServiceClientMock).not.toHaveBeenCalled();
        expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    it('adds accepted-status guards to complete, reject and reopen updates', async () => {
        const auth = { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })) };
        const completeUpdate = query({ data: [{ id: 'proposal-1' }], error: null });
        const rejectUpdate = query({ data: [{ id: 'proposal-1' }], error: null });
        const reopenRead = query({
            data: {
                status: 'accepted',
                alta_status: 'rechazada',
                consent_confirmed_at: '2026-07-01T10:00:00.000Z',
            },
            error: null,
        });
        const reopenUpdate = query({ data: [{ id: 'proposal-1' }], error: null });
        const proposalCalls = [completeUpdate, rejectUpdate, reopenRead, reopenUpdate];
        const from = vi.fn((table: string) => {
            if (table === 'proposals') {
                return proposalCalls.shift() ?? query({ data: null, error: null });
            }
            return query({ data: null, error: null });
        });
        createClientMock.mockResolvedValue({ auth, from });

        const { completeAlta, rejectAlta, reopenAlta } = await import('../alta');

        await completeAlta('proposal-1');
        await rejectAlta({ proposalId: '11111111-1111-4111-8111-111111111111', reason: 'otro' });
        await reopenAlta('proposal-1');

        expect(completeUpdate.eq).toHaveBeenCalledWith('status', 'accepted');
        expect(rejectUpdate.eq).toHaveBeenCalledWith('status', 'accepted');
        expect(reopenUpdate.eq).toHaveBeenCalledWith('status', 'accepted');
    });
});
