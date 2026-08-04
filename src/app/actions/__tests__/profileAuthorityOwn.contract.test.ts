import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    createClientMock,
    createServiceClientMock,
    requireServerRoleMock,
    revalidatePathMock,
} = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createServiceClientMock: vi.fn(),
    requireServerRoleMock: vi.fn(),
    revalidatePathMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('@/lib/auth/permissions', async (importOriginal) => ({
    ...await importOriginal<typeof import('@/lib/auth/permissions')>(),
    requireServerRole: requireServerRoleMock,
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

import * as profileActions from '../profile';
import { getFranchiseId } from '@/services/crm/shared';

type ActionResult<T = unknown> =
    | { success: true; data: T }
    | { success: false; error: string };

type UpdateOwnProfile = (input: {
    fullName: string;
    phone: string;
    bio: string;
    timezone: string;
}) => Promise<ActionResult<null>>;

type TrustedActor = {
    id: string;
    role: 'admin' | 'franchise' | 'agent';
    franchiseId: string | null;
    parentId: string | null;
};

type GetTrustedActorProfile = () => Promise<TrustedActor>;

const actorId = '11111111-1111-4111-8111-111111111111';
const parentId = '22222222-2222-4222-8222-222222222222';
const activeFranchiseId = '33333333-3333-4333-8333-333333333333';

function requireContract<T>(module: object, exportName: string): T {
    const candidate = (module as Record<string, unknown>)[exportName];
    expect(candidate, `${exportName} contract is not implemented`).toBeTypeOf('function');
    return candidate as T;
}

async function loadTrustedActorContract(): Promise<GetTrustedActorProfile> {
    const actualPermissions = await vi.importActual<Record<string, unknown>>('@/lib/auth/permissions');
    return requireContract<GetTrustedActorProfile>(actualPermissions, 'getTrustedActorProfile');
}

function sessionClient() {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: actorId, email: 'actor@example.test' } },
                error: null,
            }),
        },
    };
}

function trustedActorClient(
    profile: Record<string, unknown> | null,
    franchise: { id: string; is_active: boolean } | null = null,
) {
    return {
        auth: sessionClient().auth,
        from: vi.fn((table: string) => {
            const data = table === 'profiles' ? profile : franchise;
            return {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
                        single: vi.fn().mockResolvedValue({ data, error: null }),
                    }),
                }),
            };
        }),
    };
}

describe('ZIN-SDD-041 strict own-profile contract (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createClientMock.mockResolvedValue(sessionClient());
    });

    it('writes exactly the four approved fields for the authenticated actor', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
        createServiceClientMock.mockReturnValue({ rpc });
        const updateOwnProfile = requireContract<UpdateOwnProfile>(profileActions, 'updateOwnProfileAction');

        const result = await updateOwnProfile({
            fullName: 'Ana Agente',
            phone: '+34600111222',
            bio: 'Especialista en pymes',
            timezone: 'Europe/Madrid',
        });

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin', 'franchise', 'agent']);
        expect(rpc).toHaveBeenCalledWith('update_own_profile', {
            p_actor_id: actorId,
            p_full_name: 'Ana Agente',
            p_phone: '+34600111222',
            p_bio: 'Especialista en pymes',
            p_timezone: 'Europe/Madrid',
        });
        expect(result).toEqual({ success: true, data: null });
    });

    it.each([
        ['unknown field', { arbitrary: true }],
        ['protected field', { role: 'admin' }],
        ['mixed fiscal field', { iban: 'ES9121000418450200051332' }],
        ['caller-selected target', { targetId: parentId }],
    ])('returns a safe validation result for an %s', async (_label, injected) => {
        const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
        createServiceClientMock.mockReturnValue({ rpc });
        const updateOwnProfile = requireContract<UpdateOwnProfile>(profileActions, 'updateOwnProfileAction');

        const result = await updateOwnProfile({
            fullName: 'Ana Agente',
            phone: '+34600111222',
            bio: '',
            timezone: 'Europe/Madrid',
            ...injected,
        });

        expect(result).toEqual({ success: false, error: 'Los datos del perfil no son válidos.' });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('keeps the onboarding adapter exact and preserves phone without accepting a target', async () => {
        const directUpdate = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
        });
        createClientMock.mockResolvedValue({
            ...sessionClient(),
            from: vi.fn().mockReturnValue({ update: directUpdate }),
        });
        const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
        createServiceClientMock.mockReturnValue({ rpc });

        await profileActions.updateAgentProfileAction({
            full_name: 'Ana Agente',
            phone: '+34600111222',
        });

        expect(rpc).toHaveBeenCalledWith('update_own_profile', {
            p_actor_id: actorId,
            p_full_name: 'Ana Agente',
            p_phone: '+34600111222',
        });
        expect(directUpdate).not.toHaveBeenCalled();
    });

    it('keeps company settings in franchise_config without rewriting personal identity', async () => {
        const directProfileUpdate = vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
        });
        const configUpsert = vi.fn().mockResolvedValue({ error: null });
        const from = vi.fn((table: string) => table === 'profiles'
            ? { update: directProfileUpdate }
            : { upsert: configUpsert });
        createClientMock.mockResolvedValue({ ...sessionClient(), from });

        await profileActions.saveProfileSettingsAction({
            companyName: 'Consultoría Segura SL',
            nif: 'B12345678',
            address: 'Calle Mayor 1',
            defaultMargin: 2.5,
            defaultVat: 21,
        });

        expect(from).not.toHaveBeenCalledWith('profiles');
        expect(directProfileUpdate).not.toHaveBeenCalled();
        expect(configUpsert).toHaveBeenCalledWith({
            owner_id: actorId,
            company_name: 'Consultoría Segura SL',
            nif: 'B12345678',
            address: 'Calle Mayor 1',
            default_margin: 2.5,
            default_vat: 21,
        }, { onConflict: 'owner_id' });
    });
});

describe('ZIN-SDD-041 canonical trusted actor resolution (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it.each([
        [
            'Admin',
            { id: actorId, role: 'admin', parent_id: null, franchise_id: null },
            null,
            { id: actorId, role: 'admin', parentId: null, franchiseId: null },
        ],
        [
            'Franchise',
            { id: actorId, role: 'franchise', parent_id: parentId, franchise_id: activeFranchiseId },
            { id: activeFranchiseId, is_active: true },
            { id: actorId, role: 'franchise', parentId, franchiseId: activeFranchiseId },
        ],
        [
            'Agent',
            { id: actorId, role: 'agent', parent_id: parentId, franchise_id: activeFranchiseId },
            { id: activeFranchiseId, is_active: true },
            { id: actorId, role: 'agent', parentId, franchiseId: activeFranchiseId },
        ],
    ] as const)('returns normalized trusted context for a canonical active %s', async (_label, profile, franchise, expected) => {
        createClientMock.mockResolvedValue(trustedActorClient(profile, franchise));
        const getTrustedActorProfile = await loadTrustedActorContract();

        await expect(getTrustedActorProfile()).resolves.toEqual(expected);
    });

    it.each([
        ['missing profile', null, null],
        ['null role', { id: actorId, role: null, parent_id: null, franchise_id: null }, null],
        ['unknown role', { id: actorId, role: 'owner', parent_id: null, franchise_id: null }, null],
        ['noncanonical Admin tuple', { id: actorId, role: 'admin', parent_id: parentId, franchise_id: activeFranchiseId }, null],
        ['Franchise without franchise', { id: actorId, role: 'franchise', parent_id: parentId, franchise_id: null }, null],
        ['Agent in inactive franchise', { id: actorId, role: 'agent', parent_id: parentId, franchise_id: activeFranchiseId }, { id: activeFranchiseId, is_active: false }],
    ])('rejects %s with one non-PII account-state error', async (_label, profile, franchise) => {
        createClientMock.mockResolvedValue(trustedActorClient(profile, franchise));
        const getTrustedActorProfile = await loadTrustedActorContract();

        await expect(getTrustedActorProfile()).rejects.toThrow('ACCOUNT_NOT_ACTIVE');
    });

    it('does not create a missing profile or substitute HQ during a tenant read', async () => {
        const profileUpsert = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                    data: { franchise_id: activeFranchiseId, role: 'agent', full_name: 'actor' },
                    error: null,
                }),
            }),
        });
        const from = vi.fn((table: string) => table === 'profiles'
            ? {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                    }),
                }),
                upsert: profileUpsert,
            }
            : {
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        maybeSingle: vi.fn().mockResolvedValue({ data: { id: activeFranchiseId } }),
                    }),
                }),
            });
        const client = { auth: sessionClient().auth, from };

        const result = await getFranchiseId(client as never);

        expect(result).toBeNull();
        expect(profileUpsert).not.toHaveBeenCalled();
        expect(from).not.toHaveBeenCalledWith('franchises');
    });
});
