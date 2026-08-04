import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    createClientMock,
    createServiceClientMock,
    requireServerRoleMock,
    revalidatePathMock,
    logAdminActionMock,
} = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createServiceClientMock: vi.fn(),
    requireServerRoleMock: vi.fn(),
    revalidatePathMock: vi.fn(),
    logAdminActionMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));
vi.mock('@/lib/audit/logger', () => ({ logAdminAction: logAdminActionMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('@/lib/resend', () => ({ resend: { emails: { send: vi.fn() } } }));

import * as adminActions from '../admin';
import * as networkActions from '../network';

type ActionResult<T = unknown> =
    | { success: true; data: T }
    | { success: false; error: string };

type AuthorityInput = {
    targetId: string;
    desiredRole: 'admin' | 'franchise' | 'agent' | null;
    parentId: string | null;
    franchiseId: string | null;
    expectedAuthorityVersion: number;
    reasonCode: string;
    requestId: string;
};

type ChangeAuthority = (input: AuthorityInput) => Promise<ActionResult<{ eventId: string }>>;
type UpdateTeamMemberName = (input: { targetId: string; fullName: string }) => Promise<ActionResult<null>>;
type GetAuthoritySummaries = () => Promise<ActionResult<Array<{
    id: string;
    email: string;
    fullName: string | null;
    role: 'admin' | 'franchise' | 'agent' | null;
    parentId: string | null;
    franchiseId: string | null;
    authorityVersion: number;
}>>>;

const actorId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const parentId = '33333333-3333-4333-8333-333333333333';
const franchiseId = '44444444-4444-4444-8444-444444444444';
const requestId = '55555555-5555-4555-8555-555555555555';
const eventId = '66666666-6666-4666-8666-666666666666';

function requireContract<T>(module: object, exportName: string): T {
    const candidate = (module as Record<string, unknown>)[exportName];
    expect(candidate, `${exportName} contract is not implemented`).toBeTypeOf('function');
    return candidate as T;
}

function sessionClient() {
    return {
        auth: {
            getUser: vi.fn().mockResolvedValue({ data: { user: { id: actorId } }, error: null }),
        },
    };
}

function authorityInput(overrides: Partial<AuthorityInput> = {}): AuthorityInput {
    return {
        targetId,
        desiredRole: 'agent',
        parentId,
        franchiseId,
        expectedAuthorityVersion: 7,
        reasonCode: 'franchise_assignment',
        requestId,
        ...overrides,
    };
}

describe('ZIN-SDD-041 Admin authority application boundary (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createClientMock.mockResolvedValue(sessionClient());
    });

    it.each([
        ['Admin', { desiredRole: 'admin', parentId: null, franchiseId: null }],
        ['Franchise', { desiredRole: 'franchise', parentId, franchiseId }],
        ['Agent', { desiredRole: 'agent', parentId, franchiseId }],
        ['pending/deactivated', { desiredRole: null, parentId: null, franchiseId: null }],
    ] as const)('maps a complete canonical %s request to the one authority RPC', async (_label, tuple) => {
        const rpc = vi.fn().mockResolvedValue({ data: { event_id: eventId }, error: null });
        createServiceClientMock.mockReturnValue({ rpc });
        const changeAuthority = requireContract<ChangeAuthority>(
            adminActions,
            'changeProfileAuthorityAdminAction',
        );

        const result = await changeAuthority(authorityInput(tuple));

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin']);
        expect(rpc).toHaveBeenCalledWith('change_profile_authority', {
            p_actor_id: actorId,
            p_target_id: targetId,
            p_desired_role: tuple.desiredRole,
            p_parent_id: tuple.parentId,
            p_franchise_id: tuple.franchiseId,
            p_expected_authority_version: 7,
            p_reason_code: 'franchise_assignment',
            p_request_id: requestId,
        });
        expect(result).toEqual({ success: true, data: { eventId } });
    });

    it.each([
        ['LAST_ADMIN', 'Debe permanecer al menos un administrador activo.'],
        ['AUTHORITY_CYCLE', 'La jerarquía propuesta no es válida.'],
        ['STALE_AUTHORITY_VERSION', 'El perfil ha cambiado. Actualiza e inténtalo de nuevo.'],
        ['REQUEST_ID_CONFLICT', 'La solicitud ya se utilizó con otros datos.'],
    ])('maps database code %s to a stable non-PII message', async (databaseCode, safeMessage) => {
        const rpc = vi.fn().mockResolvedValue({
            data: null,
            error: {
                code: 'P0001',
                message: databaseCode,
                details: 'email=persona@example.test; internal relation profiles_parent_id_fkey',
            },
        });
        createServiceClientMock.mockReturnValue({ rpc });
        const changeAuthority = requireContract<ChangeAuthority>(
            adminActions,
            'changeProfileAuthorityAdminAction',
        );

        const result = await changeAuthority(authorityInput());

        expect(result).toEqual({ success: false, error: safeMessage });
        expect(JSON.stringify(result)).not.toContain('persona@example.test');
        expect(JSON.stringify(result)).not.toContain('profiles_parent_id_fkey');
    });

    it('sanitizes an unknown database failure instead of returning raw detail', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'duplicate key value violates profiles_pkey (persona@example.test)' },
        });
        createServiceClientMock.mockReturnValue({ rpc });
        const changeAuthority = requireContract<ChangeAuthority>(
            adminActions,
            'changeProfileAuthorityAdminAction',
        );

        const result = await changeAuthority(authorityInput());

        expect(result).toEqual({ success: false, error: 'No se pudo actualizar la autoridad.' });
    });

    it('rejects an absent reason with a safe ActionResult before database access', async () => {
        const rpc = vi.fn();
        createServiceClientMock.mockReturnValue({ rpc });
        const changeAuthority = requireContract<ChangeAuthority>(adminActions, 'changeProfileAuthorityAdminAction');

        const result = await changeAuthority(authorityInput({ reasonCode: '' }));

        expect(result).toEqual({ success: false, error: 'Selecciona un motivo válido.' });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('rejects a reason outside the closed catalogue with a safe ActionResult', async () => {
        const rpc = vi.fn();
        createServiceClientMock.mockReturnValue({ rpc });
        const changeAuthority = requireContract<ChangeAuthority>(adminActions, 'changeProfileAuthorityAdminAction');

        const result = await changeAuthority(authorityInput({
            reasonCode: 'porque lo ha pedido por teléfono',
        }));

        expect(result).toEqual({ success: false, error: 'Selecciona un motivo válido.' });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('rejects an injected actor id and always binds the actor from the session', async () => {
        const rpc = vi.fn();
        createServiceClientMock.mockReturnValue({ rpc });
        const changeAuthority = requireContract<ChangeAuthority>(adminActions, 'changeProfileAuthorityAdminAction');
        const manipulated = {
            ...authorityInput(),
            actorId: '99999999-9999-4999-8999-999999999999',
        };

        const result = await changeAuthority(manipulated);

        expect(result).toEqual({ success: false, error: 'La solicitud de autoridad no es válida.' });
        expect(rpc).not.toHaveBeenCalled();
    });
});

describe('ZIN-SDD-041 identity and authority are independent saves (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createClientMock.mockResolvedValue(sessionClient());
    });

    it('rejects the legacy combined Admin name plus authority payload without writing either domain', async () => {
        const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
        createServiceClientMock.mockReturnValue({ from: vi.fn().mockReturnValue({ update }) });

        const result = await adminActions.updateAgentAdminAction(targetId, {
            full_name: 'Nombre corregido',
            role: 'franchise',
            franchise_id: franchiseId,
        }) as unknown;

        expect(result).toEqual({ success: false, error: 'Guarda identidad y autoridad por separado.' });
        expect(update).not.toHaveBeenCalled();
    });

    it('maps an Admin name save only to the scoped identity command', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
        createServiceClientMock.mockReturnValue({ rpc });
        const updateTeamMemberName = requireContract<UpdateTeamMemberName>(
            networkActions,
            'updateTeamMemberNameAction',
        );

        const result = await updateTeamMemberName({ targetId, fullName: 'Nombre corregido' });

        expect(rpc).toHaveBeenCalledWith('update_team_member_name', {
            p_actor_id: actorId,
            p_target_id: targetId,
            p_full_name: 'Nombre corregido',
        });
        expect(result).toEqual({ success: true, data: null });
    });

    it('binds the scoped identity actor to the session and rejects extra identity fields', async () => {
        const rpc = vi.fn();
        createServiceClientMock.mockReturnValue({ rpc });
        const updateTeamMemberName = requireContract<UpdateTeamMemberName>(
            networkActions,
            'updateTeamMemberNameAction',
        );

        const result = await updateTeamMemberName({
            targetId,
            fullName: 'Nombre corregido',
            email: 'inyectado@example.test',
        } as { targetId: string; fullName: string });

        expect(result).toEqual({ success: false, error: 'La corrección de nombre no es válida.' });
        expect(rpc).not.toHaveBeenCalled();
    });

    it('keeps the legacy network adapter name-only and delegates to the scoped identity RPC', async () => {
        const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
        createServiceClientMock.mockReturnValue({ rpc });
        const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
        createClientMock.mockResolvedValue({ ...sessionClient(), from: vi.fn().mockReturnValue({ update }) });

        const result = await networkActions.updateNetworkUserAction(targetId, {
            full_name: ' Nombre corregido ',
        }) as unknown;

        expect(rpc).toHaveBeenCalledWith('update_team_member_name', {
            p_actor_id: actorId,
            p_target_id: targetId,
            p_full_name: 'Nombre corregido',
        });
        expect(result).toEqual({ success: true, data: null });
    });

    it('returns a safe validation result for isolated email editing', async () => {
        const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
        createClientMock.mockResolvedValue({
            ...sessionClient(),
            from: vi.fn().mockReturnValue({ update }),
        });

        const result = await networkActions.updateNetworkUserAction(targetId, {
            email: 'nuevo@example.test',
        }) as unknown;

        expect(result).toEqual({ success: false, error: 'El email no se puede editar desde la red.' });
        expect(update).not.toHaveBeenCalled();
    });

    it('does not leak database details when the locked subordinate predicate rejects the change', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'TEAM_MEMBER_SCOPE_INVALID persona@example.test profiles_parent_id_fkey' },
        });
        createServiceClientMock.mockReturnValue({ rpc });
        const updateTeamMemberName = requireContract<UpdateTeamMemberName>(
            networkActions,
            'updateTeamMemberNameAction',
        );

        const result = await updateTeamMemberName({ targetId, fullName: 'Nombre corregido' });

        expect(result).toEqual({ success: false, error: 'No se pudo actualizar el nombre.' });
        expect(JSON.stringify(result)).not.toContain('persona@example.test');
        expect(JSON.stringify(result)).not.toContain('profiles_parent_id_fkey');
    });
});

describe('ZIN-SDD-041 Admin authority summaries (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
    });

    it('returns only the explicit Admin authority projection and maps authorityVersion', async () => {
        const rows = [{
            id: targetId,
            email: 'persona@example.test',
            full_name: 'Persona',
            role: 'agent',
            parent_id: parentId,
            franchise_id: franchiseId,
            authority_version: 7,
        }];
        const order = vi.fn().mockResolvedValue({ data: rows, error: null });
        const select = vi.fn().mockReturnValue({ order });
        createServiceClientMock.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) });
        const getSummaries = requireContract<GetAuthoritySummaries>(
            adminActions,
            'getAdminProfileAuthoritySummariesAction',
        );

        const result = await getSummaries();

        expect(requireServerRoleMock).toHaveBeenCalledWith(['admin']);
        expect(select).toHaveBeenCalledWith(
            'id, email, full_name, role, parent_id, franchise_id, authority_version',
        );
        expect(result).toEqual({
            success: true,
            data: [{
                id: targetId,
                email: 'persona@example.test',
                fullName: 'Persona',
                role: 'agent',
                parentId,
                franchiseId,
                authorityVersion: 7,
            }],
        });
    });

    it('returns a stable safe error when the authority projection cannot be loaded', async () => {
        const order = vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'persona@example.test profiles_authority_version_idx' },
        });
        createServiceClientMock.mockReturnValue({
            from: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ order }) }),
        });
        const getSummaries = requireContract<GetAuthoritySummaries>(
            adminActions,
            'getAdminProfileAuthoritySummariesAction',
        );

        const result = await getSummaries();

        expect(result).toEqual({ success: false, error: 'No se pudieron cargar los perfiles.' });
        expect(JSON.stringify(result)).not.toContain('persona@example.test');
    });
});

describe('ZIN-SDD-041 legacy authority adapters (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createClientMock.mockResolvedValue(sessionClient());
    });

    function authorityService(target: {
        role: 'admin' | 'franchise' | 'agent' | null;
        parent_id: string | null;
        franchise_id: string | null;
        authority_version: number;
    }) {
        const maybeSingle = vi.fn().mockResolvedValue({
            data: { id: targetId, ...target },
            error: null,
        });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        const rpc = vi.fn().mockResolvedValue({ data: { event_id: eventId }, error: null });
        const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
        const from = vi.fn().mockReturnValue({ select, update });
        createServiceClientMock.mockReturnValue({ from, rpc });
        createClientMock.mockResolvedValue({ ...sessionClient(), from });
        return { rpc, select };
    }

    it('assigns a franchise through the full canonical Agent tuple', async () => {
        const { rpc } = authorityService({
            role: 'agent',
            parent_id: null,
            franchise_id: null,
            authority_version: 4,
        });

        const result = await adminActions.assignAgentToFranchise(targetId, franchiseId) as unknown;

        expect(rpc).toHaveBeenCalledWith('change_profile_authority', expect.objectContaining({
            p_actor_id: actorId,
            p_target_id: targetId,
            p_desired_role: 'agent',
            p_parent_id: actorId,
            p_franchise_id: franchiseId,
            p_expected_authority_version: 4,
            p_reason_code: 'franchise_assignment',
            p_request_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        }));
        expect(result).toEqual({ success: true, data: { eventId } });
    });

    it('removes a franchise by clearing the complete authority tuple', async () => {
        const { rpc } = authorityService({
            role: 'agent',
            parent_id: parentId,
            franchise_id: franchiseId,
            authority_version: 5,
        });

        const result = await adminActions.removeAgentFromFranchise(targetId) as unknown;

        expect(rpc).toHaveBeenCalledWith('change_profile_authority', expect.objectContaining({
            p_actor_id: actorId,
            p_target_id: targetId,
            p_desired_role: null,
            p_parent_id: null,
            p_franchise_id: null,
            p_expected_authority_version: 5,
            p_reason_code: 'franchise_removal',
        }));
        expect(result).toEqual({ success: true, data: { eventId } });
    });

    it('deactivates through the same command and never performs a generic profile update', async () => {
        const { rpc } = authorityService({
            role: 'franchise',
            parent_id: parentId,
            franchise_id: franchiseId,
            authority_version: 6,
        });

        const result = await networkActions.deactivateProfileAction(targetId) as unknown;

        expect(rpc).toHaveBeenCalledWith('change_profile_authority', expect.objectContaining({
            p_desired_role: null,
            p_parent_id: null,
            p_franchise_id: null,
            p_expected_authority_version: 6,
            p_reason_code: 'deactivation',
        }));
        expect(result).toEqual({ success: true, data: { eventId } });
    });

    it('requires a complete tuple to reactivate and maps it to the same command', async () => {
        const { rpc } = authorityService({
            role: null,
            parent_id: null,
            franchise_id: null,
            authority_version: 8,
        });

        const result = await networkActions.reactivateProfileAction(targetId, {
            desiredRole: 'agent',
            parentId,
            franchiseId,
        } as never) as unknown;

        expect(rpc).toHaveBeenCalledWith('change_profile_authority', expect.objectContaining({
            p_desired_role: 'agent',
            p_parent_id: parentId,
            p_franchise_id: franchiseId,
            p_expected_authority_version: 8,
            p_reason_code: 'reactivation',
        }));
        expect(result).toEqual({ success: true, data: { eventId } });
    });

    it('rejects legacy role-only reactivation instead of restoring an incomplete tuple', async () => {
        const { rpc } = authorityService({
            role: null,
            parent_id: null,
            franchise_id: null,
            authority_version: 8,
        });

        const result = await networkActions.reactivateProfileAction(targetId, 'agent') as unknown;

        expect(result).toEqual({ success: false, error: 'La reactivación requiere una autoridad completa.' });
        expect(rpc).not.toHaveBeenCalled();
    });
});
