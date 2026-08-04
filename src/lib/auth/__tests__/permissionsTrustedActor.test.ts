import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createClientMock } = vi.hoisted(() => ({ createClientMock: vi.fn() }));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));

import { getUserRole, requireServerRole } from '../permissions';

const actorId = '11111111-1111-4111-8111-111111111111';
const parentId = '22222222-2222-4222-8222-222222222222';
const franchiseId = '33333333-3333-4333-8333-333333333333';

function clientFor(profile: Record<string, unknown>, isActive: boolean) {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: actorId } },
                error: null,
            }),
        },
        from: vi.fn((table: string) => ({
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                        data: table === 'profiles'
                            ? profile
                            : { id: franchiseId, is_active: isActive },
                        error: null,
                    }),
                }),
            }),
        })),
    };
}

describe('trusted role guards', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns a canonical active role and permits the matching guard', async () => {
        createClientMock.mockResolvedValue(clientFor({
            id: actorId,
            role: 'agent',
            parent_id: parentId,
            franchise_id: franchiseId,
        }, true));

        await expect(getUserRole()).resolves.toBe('agent');
        await expect(requireServerRole(['agent'])).resolves.toBeUndefined();
    });

    it('returns no role and denies the guard when the tenant is inactive', async () => {
        createClientMock.mockResolvedValue(clientFor({
            id: actorId,
            role: 'agent',
            parent_id: parentId,
            franchise_id: franchiseId,
        }, false));

        await expect(getUserRole()).resolves.toBeNull();
        await expect(requireServerRole(['agent'])).rejects.toThrow('Forbidden');
    });
});
