import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { requireServerRoleMock, createClientMock, rpcMock, fromMock } = vi.hoisted(() => ({
    requireServerRoleMock: vi.fn(),
    createClientMock: vi.fn(),
    rpcMock: vi.fn(),
    fromMock: vi.fn(),
}));

vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import {
    cancelClientOwnershipTransferAction,
    decideClientOwnershipTransferAction,
    getClientOwnershipHistoryAction,
    requestClientOwnershipTransferAction,
    transferClientOwnershipAction,
} from '../clientOwnership';

const CLIENT_ID = '11111111-1111-4111-8111-111111111111';
const TO_OWNER_ID = '22222222-2222-4222-8222-222222222222';
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
const EVENT_ID = '44444444-4444-4444-8444-444444444444';

function validInput(overrides: Record<string, unknown> = {}) {
    return {
        clientId: CLIENT_ID,
        toOwnerId: TO_OWNER_ID,
        expectedOwnershipVersion: 3,
        reason: 'agent_reassignment' as const,
        requestId: REQUEST_ID,
        ...overrides,
    };
}

beforeEach(() => {
    createClientMock.mockResolvedValue({ rpc: rpcMock, from: fromMock });
    requireServerRoleMock.mockResolvedValue(undefined);
    rpcMock.mockResolvedValue({ data: { event_id: EVENT_ID, applied: true }, error: null });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('transferClientOwnershipAction', () => {
    it('restricts the transfer to admin and franchise', async () => {
        await transferClientOwnershipAction(validInput());

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise']);
    });

    it('forwards the optimistic version and the idempotency key unchanged', async () => {
        await transferClientOwnershipAction(validInput());

        expect(rpcMock).toHaveBeenCalledWith('transfer_client_ownership', {
            p_client_id: CLIENT_ID,
            p_to_owner_id: TO_OWNER_ID,
            p_expected_ownership_version: 3,
            p_reason_code: 'agent_reassignment',
            p_request_id: REQUEST_ID,
            p_notes: null,
        });
    });

    it('generates a request id when the caller does not supply one', async () => {
        await transferClientOwnershipAction(validInput({ requestId: undefined }));

        const args = rpcMock.mock.calls[0][1] as { p_request_id: string };
        expect(args.p_request_id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('reports an idempotent replay as not applied', async () => {
        rpcMock.mockResolvedValue({ data: { event_id: EVENT_ID, applied: false }, error: null });

        await expect(transferClientOwnershipAction(validInput()))
            .resolves.toEqual({ success: true, data: { eventId: EVENT_ID, applied: false } });
    });

    it.each([
        ['bad client id', { clientId: 'nope' }],
        ['negative version', { expectedOwnershipVersion: -1 }],
        ['unknown reason', { reason: 'because' }],
        ['overlong notes', { notes: 'x'.repeat(501) }],
    ])('rejects invalid input without calling the database (%s)', async (_label, overrides) => {
        const result = await transferClientOwnershipAction(validInput(overrides) as never);

        expect(result.success).toBe(false);
        expect(rpcMock).not.toHaveBeenCalled();
    });

    it('turns a stale version into an actionable message', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'OWNERSHIP_STALE_VERSION' } });

        const result = await transferClientOwnershipAction(validInput());

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/Recarga/);
    });

    it('does not leak an unmapped database error to the browser', async () => {
        rpcMock.mockResolvedValue({
            data: null,
            error: { message: 'permission denied for relation clients_secret_backup' },
        });

        const result = await transferClientOwnershipAction(validInput());

        expect(result.success).toBe(false);
        if (!result.success) {
            expect(result.error).toBe('No se pudo completar el traspaso.');
            expect(result.error).not.toMatch(/relation|permission/i);
        }
    });

    it('fails when the command returns no event id', async () => {
        rpcMock.mockResolvedValue({ data: { applied: true }, error: null });

        await expect(transferClientOwnershipAction(validInput()))
            .resolves.toMatchObject({ success: false });
    });
});

describe('requestClientOwnershipTransferAction', () => {
    const validRequest = { clientId: CLIENT_ID, toOwnerId: TO_OWNER_ID, reason: 'agent_departure' as const };

    it('is open to agents, because asking is the point', async () => {
        rpcMock.mockResolvedValue({ data: { request_id: REQUEST_ID, created: true }, error: null });

        await requestClientOwnershipTransferAction(validRequest);

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise', 'agent']);
    });

    it('reports a repeated identical ask as not created', async () => {
        rpcMock.mockResolvedValue({ data: { request_id: REQUEST_ID, created: false }, error: null });

        await expect(requestClientOwnershipTransferAction(validRequest))
            .resolves.toEqual({ success: true, data: { requestId: REQUEST_ID, created: false } });
    });

    it('explains a competing pending request instead of failing generically', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'TRANSFER_REQUEST_ALREADY_PENDING' } });

        const result = await requestClientOwnershipTransferAction(validRequest);

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/solicitud abierta/i);
    });

    it('rejects an unknown reason without calling the database', async () => {
        const result = await requestClientOwnershipTransferAction({
            ...validRequest,
            reason: 'because' as 'agent_departure',
        });

        expect(result.success).toBe(false);
        expect(rpcMock).not.toHaveBeenCalled();
    });
});

describe('decideClientOwnershipTransferAction', () => {
    it('restricts the decision to admin and franchise', async () => {
        rpcMock.mockResolvedValue({ data: { status: 'approved', event_id: EVENT_ID }, error: null });

        await decideClientOwnershipTransferAction(REQUEST_ID, true);

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise']);
    });

    it('passes the rejection through without transferring', async () => {
        rpcMock.mockResolvedValue({ data: { status: 'rejected' }, error: null });

        await expect(decideClientOwnershipTransferAction(REQUEST_ID, false, 'No procede'))
            .resolves.toEqual({ success: true, data: { status: 'rejected' } });
        expect(rpcMock).toHaveBeenCalledWith('decide_client_ownership_transfer', {
            p_request_id: REQUEST_ID,
            p_approve: false,
            p_decision_notes: 'No procede',
        });
    });

    it('surfaces a self-approval attempt as its own message', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'TRANSFER_DECISION_SELF_APPROVAL' } });

        const result = await decideClientOwnershipTransferAction(REQUEST_ID, true);

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/tu propia solicitud/i);
    });

    it('surfaces a stale request as something to review, not a generic failure', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'TRANSFER_DECISION_STALE' } });

        const result = await decideClientOwnershipTransferAction(REQUEST_ID, true);

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/cambiado de propietario/i);
    });

    it('does not report success on an unexpected status', async () => {
        rpcMock.mockResolvedValue({ data: { status: 'pending' }, error: null });

        await expect(decideClientOwnershipTransferAction(REQUEST_ID, true))
            .resolves.toMatchObject({ success: false });
    });

    it('rejects a non-boolean decision without calling the database', async () => {
        const result = await decideClientOwnershipTransferAction(REQUEST_ID, 'yes' as unknown as boolean);

        expect(result.success).toBe(false);
        expect(rpcMock).not.toHaveBeenCalled();
    });
});

describe('cancelClientOwnershipTransferAction', () => {
    it('cancels a pending request', async () => {
        rpcMock.mockResolvedValue({ data: { status: 'cancelled' }, error: null });

        await expect(cancelClientOwnershipTransferAction(REQUEST_ID))
            .resolves.toEqual({ success: true, data: null });
    });

    it('does not report success when the request was already decided', async () => {
        rpcMock.mockResolvedValue({ data: null, error: { message: 'TRANSFER_DECISION_ALREADY_DECIDED' } });

        const result = await cancelClientOwnershipTransferAction(REQUEST_ID);

        expect(result.success).toBe(false);
        if (!result.success) expect(result.error).toMatch(/ya está resuelta/i);
    });
});

describe('getClientOwnershipHistoryAction', () => {
    function historyReturning(data: unknown, error: unknown = null) {
        const limit = vi.fn().mockResolvedValue({ data, error });
        fromMock.mockReturnValue({
            select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ limit })) })) })),
        });
        return limit;
    }

    it('maps events to the client-facing shape', async () => {
        historyReturning([{
            id: EVENT_ID,
            created_at: '2026-08-04T09:00:00.000Z',
            actor_id: TO_OWNER_ID,
            from_owner_id: CLIENT_ID,
            to_owner_id: TO_OWNER_ID,
            reason_code: 'dispute_resolution',
            notes: null,
        }]);

        await expect(getClientOwnershipHistoryAction(CLIENT_ID)).resolves.toEqual([{
            id: EVENT_ID,
            createdAt: '2026-08-04T09:00:00.000Z',
            actorId: TO_OWNER_ID,
            fromOwnerId: CLIENT_ID,
            toOwnerId: TO_OWNER_ID,
            reason: 'dispute_resolution',
            notes: null,
        }]);
    });

    it('returns nothing for a non-uuid without querying', async () => {
        await expect(getClientOwnershipHistoryAction('nope')).resolves.toEqual([]);
        expect(fromMock).not.toHaveBeenCalled();
    });

    it('returns nothing when the query errors instead of surfacing it', async () => {
        historyReturning(null, { message: 'boom' });

        await expect(getClientOwnershipHistoryAction(CLIENT_ID)).resolves.toEqual([]);
    });
});
