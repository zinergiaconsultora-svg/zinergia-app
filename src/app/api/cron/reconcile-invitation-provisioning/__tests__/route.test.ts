import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createServiceClientMock, loggerWarnMock } = vi.hoisted(() => ({
    createServiceClientMock: vi.fn(),
    loggerWarnMock: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));

vi.mock('@/lib/utils/logger', () => ({
    logger: { warn: loggerWarnMock },
}));

import { GET } from '../route';

const provisioningId = '11111111-1111-4111-8111-111111111111';
const invitationId = '22222222-2222-4222-8222-222222222222';
const authUserId = '33333333-3333-4333-8333-333333333333';
const email = 'invitee@example.test';

function request(authorization?: string) {
    return new Request('http://localhost/api/cron/reconcile-invitation-provisioning', {
        headers: authorization ? { authorization } : {},
    });
}

function candidate(status = 'authority_committed') {
    return {
        provisioning_id: provisioningId,
        invitation_id: invitationId,
        auth_user_id: authUserId,
        status,
        banned_until: null,
        created_at: '2020-01-01T00:00:00.000Z',
    };
}

function queryResult(data: unknown, error: unknown = null) {
    return Promise.resolve({ data, error });
}

function serviceFor(candidates: unknown[], authorityCommittedAt: string | null = null) {
    const rpc = vi.fn((name: string) => {
        if (name === 'reconcile_profile_invitation_provisioning') return queryResult(candidates);
        return queryResult(null);
    });
    const maybeSingle = vi.fn((table: string) => table === 'network_invitations'
        ? queryResult({ email })
        : queryResult({ authority_committed_at: authorityCommittedAt }));
    const service = {
        rpc,
        from: vi.fn((table: string) => ({
            select: vi.fn(() => ({
                eq: vi.fn(() => ({
                    maybeSingle: vi.fn(() => maybeSingle(table)),
                })),
            })),
        })),
        auth: {
            admin: {
                getUserById: vi.fn(),
                listUsers: vi.fn(),
                updateUserById: vi.fn(),
            },
        },
    };
    return { service, rpc, maybeSingle };
}

describe('GET /api/cron/reconcile-invitation-provisioning', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = 'exact-cron-secret';
    });

    afterEach(() => {
        delete process.env.CRON_SECRET;
    });

    it.each([
        undefined,
        'exact-cron-secret',
        'bearer exact-cron-secret',
        'Bearer wrong-secret',
        'Bearer  exact-cron-secret',
    ])('rejects non-exact cron authorization %s before service-role work', async (authorization) => {
        const response = await GET(request(authorization));

        expect(response.status).toBe(401);
        await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('accepts only the exact bearer value and claims a batch capped at 100', async () => {
        const context = serviceFor([]);
        createServiceClientMock.mockReturnValue(context.service);

        const response = await GET(request('Bearer exact-cron-secret'));

        expect(response.status).toBe(200);
        expect(context.rpc).toHaveBeenCalledTimes(1);
        expect(context.rpc).toHaveBeenCalledWith('reconcile_profile_invitation_provisioning', {
            p_limit: 100,
        });
        await expect(response.json()).resolves.toEqual({
            success: true,
            processed: 0,
            completed: 0,
            review: 0,
        });
    });

    it('completes needs_reconciliation only when authority commit evidence exists', async () => {
        const context = serviceFor(
            [candidate('needs_reconciliation')],
            '2026-08-03T12:00:00.000Z',
        );
        context.service.auth.admin.getUserById.mockResolvedValue({
            data: {
                user: {
                    id: authUserId,
                    email,
                    banned_until: null,
                    app_metadata: { zinergia_provisioning_id: provisioningId },
                },
            },
            error: null,
        });
        createServiceClientMock.mockReturnValue(context.service);

        const response = await GET(request('Bearer exact-cron-secret'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            processed: 1,
            completed: 1,
            review: 0,
        });
        expect(context.service.auth.admin.updateUserById).not.toHaveBeenCalled();
        expect(context.rpc).toHaveBeenCalledWith('complete_profile_invitation_provisioning', {
            p_provisioning_id: provisioningId,
            p_auth_user_id: authUserId,
            p_observed_banned_until: null,
        });
        expect(loggerWarnMock).not.toHaveBeenCalled();
    });

    it('does not alert for an old authority_committed candidate that it completes', async () => {
        const context = serviceFor(
            [candidate('authority_committed')],
            '2026-08-03T12:00:00.000Z',
        );
        context.service.auth.admin.getUserById.mockResolvedValue({
            data: {
                user: {
                    id: authUserId,
                    email,
                    banned_until: null,
                    app_metadata: { zinergia_provisioning_id: provisioningId },
                },
            },
            error: null,
        });
        createServiceClientMock.mockReturnValue(context.service);

        const response = await GET(request('Bearer exact-cron-secret'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(expect.objectContaining({
            completed: 1,
            review: 0,
        }));
        expect(loggerWarnMock).not.toHaveBeenCalled();
    });

    it('does not alert for a recent unresolved needs_reconciliation candidate', async () => {
        const reviewCandidate = {
            ...candidate('needs_reconciliation'),
            created_at: new Date().toISOString(),
        };
        const context = serviceFor([reviewCandidate]);
        context.service.auth.admin.getUserById.mockResolvedValue({
            data: { user: null },
            error: new Error('not found'),
        });
        createServiceClientMock.mockReturnValue(context.service);

        const response = await GET(request('Bearer exact-cron-secret'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            success: true,
            processed: 1,
            completed: 0,
            review: 1,
        });
        expect(loggerWarnMock).not.toHaveBeenCalled();
    });

    it('emits one non-PII alert when an unresolved candidate exceeds 15 minutes', async () => {
        const context = serviceFor([candidate('needs_reconciliation')]);
        context.service.auth.admin.getUserById.mockResolvedValue({
            data: { user: null },
            error: new Error('not found'),
        });
        createServiceClientMock.mockReturnValue(context.service);

        const response = await GET(request('Bearer exact-cron-secret'));

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual(expect.objectContaining({
            completed: 0,
            review: 1,
        }));
        expect(loggerWarnMock).toHaveBeenCalledTimes(1);
        expect(loggerWarnMock).toHaveBeenCalledWith(
            '[profile-invitation-reconciliation] incomplete provisioning requires review',
            { safeCode: 'provisioning_needs_reconciliation' },
        );
    });
});
