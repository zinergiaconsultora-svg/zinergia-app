import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createServiceClientMock } = vi.hoisted(() => ({
    createServiceClientMock: vi.fn(),
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));

import { POST } from '../route';

const invitationId = '11111111-1111-4111-8111-111111111111';
const provisioningId = '22222222-2222-4222-8222-222222222222';
const requestId = '33333333-3333-4333-8333-333333333333';
const authUserId = '44444444-4444-4444-8444-444444444444';
const futureBan = '2099-01-01T00:00:00.000Z';

const validBody = {
    invitationId,
    email: 'invitee@example.test',
    fullName: 'Persona Invitada',
    password: 'a-secure-password',
    requestId,
};

function request(body: unknown) {
    return new Request('http://localhost/api/join/provision', {
        method: 'POST',
        headers: {
            'content-type': 'application/json',
            'x-forwarded-for': '203.0.113.7, 10.0.0.1',
        },
        body: JSON.stringify(body),
    });
}

function rpcResult(data: unknown = null, error: unknown = null) {
    return Promise.resolve({ data, error });
}

type MockAuthUser = {
    id: string;
    email: string;
    banned_until: string | null;
    app_metadata: Record<string, string>;
};

function serviceFor(
    status: string = 'prepared',
    existingAuthUserId: string | null = null,
    authorityCommittedAt: string | null = null,
) {
    const events: string[] = [];
    const rpc = vi.fn((name: string) => {
        if (name === 'consume_profile_join_rate_limit') {
            return rpcResult({ receipt_id: '55555555-5555-4555-8555-555555555555' });
        }
        if (name === 'claim_profile_join_rate_limit_receipt') return rpcResult();
        if (name === 'begin_profile_invitation_provisioning') {
            return rpcResult({
                provisioning_id: provisioningId,
                status,
                auth_user_id: existingAuthUserId,
            });
        }
        if (name === 'record_profile_invitation_auth_user') events.push('record');
        if (name === 'finalize_profile_invitation_authority') events.push('finalize');
        if (name === 'complete_profile_invitation_provisioning') events.push('complete');
        return rpcResult();
    });
    const createUser = vi.fn(async (): Promise<{
        data: { user: MockAuthUser | null };
        error: Error | null;
    }> => {
        events.push('block');
        return {
            data: {
                user: {
                    id: authUserId,
                    email: validBody.email,
                    banned_until: futureBan,
                    app_metadata: { zinergia_provisioning_id: provisioningId },
                },
            },
            error: null,
        };
    });
    const updateUserById = vi.fn(async () => {
        events.push('unblock');
        return {
            data: {
                user: {
                    id: authUserId,
                    email: validBody.email,
                    banned_until: null,
                    app_metadata: { zinergia_provisioning_id: provisioningId },
                },
            },
            error: null,
        };
    });
    const getUserById = vi.fn();
    const listUsers = vi.fn();
    const from = vi.fn(() => ({
        select: vi.fn(() => ({
            eq: vi.fn(() => ({
                maybeSingle: vi.fn(() => rpcResult({
                    authority_committed_at: authorityCommittedAt,
                })),
            })),
        })),
    }));
    return {
        service: {
            rpc,
            from,
            auth: { admin: { createUser, updateUserById, getUserById, listUsers } },
        },
        rpc,
        events,
        createUser,
        updateUserById,
        getUserById,
        listUsers,
    };
}

async function bodyOf(response: Response) {
    return response.json() as Promise<Record<string, unknown>>;
}

describe('POST /api/join/provision', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.PROFILE_JOIN_RATE_LIMIT_PEPPER = 'test-pepper-with-no-pii';
    });

    it('blocks, records, finalizes, unblocks and completes in that exact order', async () => {
        const context = serviceFor();
        createServiceClientMock.mockReturnValue(context.service);

        const response = await POST(request(validBody));

        expect(response.status).toBe(200);
        await expect(bodyOf(response)).resolves.toEqual({ success: true });
        expect(context.events).toEqual(['block', 'record', 'finalize', 'unblock', 'complete']);
        expect(context.createUser).toHaveBeenCalledWith(expect.objectContaining({
            email_confirm: true,
            ban_duration: '87600h',
            app_metadata: { zinergia_provisioning_id: provisioningId },
        }));
        expect(context.updateUserById).toHaveBeenCalledWith(authUserId, { ban_duration: 'none' });
    });

    it('returns the same generic response for malformed input and a rejected invitation', async () => {
        const malformed = await POST(request({ ...validBody, role: 'admin' }));
        const context = serviceFor();
        context.rpc.mockImplementation((name: string) => {
            if (name === 'consume_profile_join_rate_limit') {
                return rpcResult({ receipt_id: '55555555-5555-4555-8555-555555555555' });
            }
            if (name === 'claim_profile_join_rate_limit_receipt') return rpcResult();
            if (name === 'begin_profile_invitation_provisioning') {
                return rpcResult(null, new Error('INVITATION_EMAIL_MISMATCH'));
            }
            return rpcResult();
        });
        createServiceClientMock.mockReturnValue(context.service);

        const rejected = await POST(request(validBody));

        expect(malformed.status).toBe(400);
        expect(rejected.status).toBe(400);
        await expect(bodyOf(malformed)).resolves.toEqual({
            success: false,
            error: 'No se pudo completar el alta.',
        });
        await expect(bodyOf(rejected)).resolves.toEqual({
            success: false,
            error: 'No se pudo completar el alta.',
        });
    });

    it('never appropriates an unrelated existing Auth account with the invited email', async () => {
        const context = serviceFor();
        context.createUser.mockResolvedValue({ data: { user: null }, error: new Error('already exists') });
        context.listUsers.mockResolvedValue({
            data: {
                users: [{
                    id: '66666666-6666-4666-8666-666666666666',
                    email: validBody.email,
                    banned_until: null,
                    app_metadata: {},
                }],
            },
            error: null,
        });
        createServiceClientMock.mockReturnValue(context.service);

        const response = await POST(request(validBody));

        expect(response.status).toBe(400);
        await expect(bodyOf(response)).resolves.toEqual({
            success: false,
            error: 'No se pudo completar el alta.',
        });
        expect(context.rpc).not.toHaveBeenCalledWith(
            'record_profile_invitation_auth_user',
            expect.anything(),
        );
        expect(context.rpc).not.toHaveBeenCalledWith(
            'finalize_profile_invitation_authority',
            expect.anything(),
        );
        expect(context.updateUserById).not.toHaveBeenCalled();
    });

    it('safely completes needs_reconciliation after proven authority commit and a successful unban', async () => {
        const context = serviceFor(
            'needs_reconciliation',
            authUserId,
            '2026-08-03T12:00:00.000Z',
        );
        context.getUserById.mockResolvedValue({
            data: {
                user: {
                    id: authUserId,
                    email: validBody.email,
                    banned_until: null,
                    app_metadata: { zinergia_provisioning_id: provisioningId },
                },
            },
            error: null,
        });
        createServiceClientMock.mockReturnValue(context.service);

        const response = await POST(request(validBody));

        expect(response.status).toBe(200);
        await expect(bodyOf(response)).resolves.toEqual({ success: true });
        expect(context.createUser).not.toHaveBeenCalled();
        expect(context.updateUserById).not.toHaveBeenCalled();
        expect(context.rpc).not.toHaveBeenCalledWith(
            'record_profile_invitation_auth_user',
            expect.anything(),
        );
        expect(context.rpc).not.toHaveBeenCalledWith(
            'finalize_profile_invitation_authority',
            expect.anything(),
        );
        expect(context.rpc).toHaveBeenCalledWith('complete_profile_invitation_provisioning', {
            p_provisioning_id: provisioningId,
            p_auth_user_id: authUserId,
            p_observed_banned_until: null,
        });
    });

    it('does not enable needs_reconciliation without an authority commit marker', async () => {
        const context = serviceFor('needs_reconciliation', authUserId, null);
        context.getUserById.mockResolvedValue({
            data: {
                user: {
                    id: authUserId,
                    email: validBody.email,
                    banned_until: null,
                    app_metadata: { zinergia_provisioning_id: provisioningId },
                },
            },
            error: null,
        });
        createServiceClientMock.mockReturnValue(context.service);

        const response = await POST(request(validBody));

        expect(response.status).toBe(400);
        expect(context.updateUserById).not.toHaveBeenCalled();
        expect(context.rpc).not.toHaveBeenCalledWith(
            'complete_profile_invitation_provisioning',
            expect.anything(),
        );
    });
});
