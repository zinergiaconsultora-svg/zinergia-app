import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    createClientMock,
    createServiceClientMock,
    requireServerRoleMock,
    resendSendMock,
} = vi.hoisted(() => ({
    createClientMock: vi.fn(),
    createServiceClientMock: vi.fn(),
    requireServerRoleMock: vi.fn(),
    resendSendMock: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));
vi.mock('@/lib/resend', () => ({ resend: { emails: { send: resendSendMock } } }));

import { createInvitationAction } from '../network';
import { validateInvitationCode } from '../join';

type ActionResult<T = unknown> =
    | { success: true; data: T }
    | { success: false; error: string };

type CreateInvitation = (input: {
    email: string;
    role: 'agent' | 'franchise';
    targetFranchiseId?: string;
}) => Promise<ActionResult<{ invitationId: string }>>;

type ProvisionPost = (request: Request) => Promise<Response>;

const adminId = '11111111-1111-4111-8111-111111111111';
const targetFranchiseId = '22222222-2222-4222-8222-222222222222';
const invitationId = '33333333-3333-4333-8333-333333333333';
const requestId = '44444444-4444-4444-8444-444444444444';
const franchiseActorId = '55555555-5555-4555-8555-555555555555';

function queryResult(data: unknown) {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
    chain.single = vi.fn().mockResolvedValue({ data, error: null });
    return chain;
}

function invitationCreationClient(options: {
    targetFranchise: { id: string; is_active: boolean } | null;
    creatorProfile?: Record<string, unknown> | null;
    actorId?: string;
}) {
    const insert = vi.fn().mockResolvedValue({ data: { id: invitationId }, error: null });
    const franchiseQuery = queryResult(options.targetFranchise);
    const profileQuery = queryResult(options.creatorProfile === undefined ? {
        id: adminId,
        full_name: 'Admin Zinergia',
        role: 'admin',
        parent_id: null,
        franchise_id: null,
    } : options.creatorProfile);
    const actorId = options.actorId ?? adminId;
    return {
        insert,
        franchiseQuery,
        client: {
            auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: actorId } }, error: null }) },
            from: vi.fn((table: string) => {
                if (table === 'profiles') return profileQuery;
                if (table === 'franchises') return franchiseQuery;
                if (table === 'network_invitations') return { insert };
                throw new Error(`Unexpected table ${table}`);
            }),
        },
    };
}

async function loadProvisionPost(): Promise<ProvisionPost> {
    const routePath = '../../api/join/provision/route';
    let routeModule: Record<string, unknown> | null = null;
    try {
        routeModule = await import(/* @vite-ignore */ routePath) as Record<string, unknown>;
    } catch {
        expect.fail('POST /api/join/provision contract is not implemented');
    }
    const post = routeModule?.POST;
    expect(post, 'POST /api/join/provision must export POST').toBeTypeOf('function');
    return post as ProvisionPost;
}

function provisionRequest(body: Record<string, unknown>) {
    return new Request('https://zinergia.example/api/join/provision', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

const validProvisionInput = {
    invitationId,
    email: 'persona@example.test',
    fullName: 'Persona Invitada',
    password: 'contraseña-segura-123',
    requestId,
};

describe('ZIN-SDD-041 invitation creation application contract (RED)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        resendSendMock.mockResolvedValue({ error: null });
    });

    it('validates an Admin target franchise as existing and active before persisting', async () => {
        const { client, franchiseQuery, insert } = invitationCreationClient({
            targetFranchise: { id: targetFranchiseId, is_active: true },
        });
        createClientMock.mockResolvedValue(client);
        createServiceClientMock.mockReturnValue(client);
        const createInvitation = createInvitationAction as unknown as CreateInvitation;

        const result = await createInvitation({
            email: 'persona@example.test',
            role: 'agent',
            targetFranchiseId,
        });

        expect(franchiseQuery.eq).toHaveBeenCalledWith('id', targetFranchiseId);
        expect(franchiseQuery.eq).toHaveBeenCalledWith('is_active', true);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            creator_id: adminId,
            email: 'persona@example.test',
            role: 'agent',
            target_franchise_id: targetFranchiseId,
        }));
        expect(result).toMatchObject({ success: true });
    });

    it.each([
        ['missing', null],
        ['inactive', { id: targetFranchiseId, is_active: false }],
    ])('returns a safe result for a %s Admin target franchise', async (_label, targetFranchise) => {
        const { client, insert } = invitationCreationClient({ targetFranchise });
        createClientMock.mockResolvedValue(client);
        createServiceClientMock.mockReturnValue(client);
        const createInvitation = createInvitationAction as unknown as CreateInvitation;

        const result = await createInvitation({
            email: 'persona@example.test',
            role: 'agent',
            targetFranchiseId,
        });

        expect(result).toEqual({ success: false, error: 'Selecciona una franquicia activa.' });
        expect(insert).not.toHaveBeenCalled();
    });

    it('rejects a malicious Admin role before reading or writing invitation state', async () => {
        const { client, insert, franchiseQuery } = invitationCreationClient({
            targetFranchise: { id: targetFranchiseId, is_active: true },
        });
        createClientMock.mockResolvedValue(client);
        createServiceClientMock.mockReturnValue(client);
        const createInvitation = createInvitationAction as unknown as CreateInvitation;

        const result = await createInvitation({
            email: 'persona@example.test',
            role: 'admin',
            targetFranchiseId,
        } as never);

        expect(result).toEqual({ success: false, error: 'El tipo de invitación no es válido.' });
        expect(franchiseQuery.eq).not.toHaveBeenCalled();
        expect(insert).not.toHaveBeenCalled();
    });

    it('allows Franchise -> Agent only after locking the creator active franchise derivation', async () => {
        const { client, insert, franchiseQuery } = invitationCreationClient({
            actorId: franchiseActorId,
            creatorProfile: {
                id: franchiseActorId,
                full_name: 'Franquicia Norte',
                role: 'franchise',
                parent_id: adminId,
                franchise_id: targetFranchiseId,
            },
            targetFranchise: { id: targetFranchiseId, is_active: true },
        });
        createClientMock.mockResolvedValue(client);
        createServiceClientMock.mockReturnValue(client);
        const createInvitation = createInvitationAction as unknown as CreateInvitation;

        const result = await createInvitation({
            email: 'colaborador@example.test',
            role: 'agent',
        });

        expect(franchiseQuery.eq).toHaveBeenCalledWith('id', targetFranchiseId);
        expect(franchiseQuery.eq).toHaveBeenCalledWith('is_active', true);
        expect(insert).toHaveBeenCalledWith(expect.objectContaining({
            creator_id: franchiseActorId,
            email: 'colaborador@example.test',
            role: 'agent',
            target_franchise_id: null,
        }));
        expect(result).toMatchObject({ success: true });
    });

    it('rejects Franchise -> Franchise before persisting invitation state', async () => {
        const { client, insert } = invitationCreationClient({
            actorId: franchiseActorId,
            creatorProfile: {
                id: franchiseActorId,
                role: 'franchise',
                parent_id: adminId,
                franchise_id: targetFranchiseId,
            },
            targetFranchise: { id: targetFranchiseId, is_active: true },
        });
        createClientMock.mockResolvedValue(client);
        createServiceClientMock.mockReturnValue(client);
        const createInvitation = createInvitationAction as unknown as CreateInvitation;

        const result = await createInvitation({
            email: 'franquicia@example.test',
            role: 'franchise',
        });

        expect(result).toEqual({
            success: false,
            error: 'Una franquicia solo puede invitar colaboradores.',
        });
        expect(insert).not.toHaveBeenCalled();
    });

    it.each([
        ['missing', null, null],
        [
            'null-role',
            { id: franchiseActorId, role: null, parent_id: null, franchise_id: null },
            null,
        ],
        [
            'inactive',
            { id: franchiseActorId, role: 'franchise', parent_id: adminId, franchise_id: targetFranchiseId },
            { id: targetFranchiseId, is_active: false },
        ],
    ])('rejects a %s invitation creator with one safe account-state result', async (_label, creatorProfile, targetFranchise) => {
        const { client, insert } = invitationCreationClient({
            actorId: franchiseActorId,
            creatorProfile,
            targetFranchise,
        });
        createClientMock.mockResolvedValue(client);
        createServiceClientMock.mockReturnValue(client);
        const createInvitation = createInvitationAction as unknown as CreateInvitation;

        const result = await createInvitation({
            email: 'colaborador@example.test',
            role: 'agent',
        });

        expect(result).toEqual({
            success: false,
            error: 'No puedes crear invitaciones con esta cuenta.',
        });
        expect(insert).not.toHaveBeenCalled();
    });
});

describe('ZIN-SDD-041 POST /api/join/provision public boundary (RED)', () => {
    it.each([
        ['role', { role: 'admin' }],
        ['parentId', { parentId: adminId }],
        ['franchiseId', { franchiseId: targetFranchiseId }],
        ['actorId', { actorId: adminId }],
    ])('strictly rejects caller-supplied authority field %s', async (_field, injected) => {
        const post = await loadProvisionPost();

        const response = await post(provisionRequest({ ...validProvisionInput, ...injected }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ success: false, error: 'No se pudo completar el alta.' });
        expect(JSON.stringify(body)).not.toContain('admin');
        expect(JSON.stringify(body)).not.toContain(targetFranchiseId);
    });

    it('uses the same non-enumerable response for distinct invalid public identities', async () => {
        const post = await loadProvisionPost();
        const first = await post(provisionRequest({
            ...validProvisionInput,
            invitationId: 'not-a-uuid',
            email: 'one@example.test',
        }));
        const second = await post(provisionRequest({
            ...validProvisionInput,
            invitationId: 'also-not-a-uuid',
            email: 'other@example.test',
        }));
        const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);

        expect(first.status).toBe(second.status);
        expect(firstBody).toEqual(secondBody);
        expect(firstBody).toEqual({ success: false, error: 'No se pudo completar el alta.' });
        expect(JSON.stringify(firstBody)).not.toMatch(/one@|other@|not-a-uuid/i);
    });

    it('rejects an existing Auth account without revealing account existence', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: { provisioning_id: requestId, status: 'prepared' },
            error: null,
        });
        const createUser = vi.fn().mockResolvedValue({
            data: { user: null },
            error: { message: 'User already exists' },
        });
        createServiceClientMock.mockReturnValue({ rpc, auth: { admin: { createUser } } });
        const post = await loadProvisionPost();

        const response = await post(provisionRequest({
            ...validProvisionInput,
            email: 'existing@example.test',
        }));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ success: false, error: 'No se pudo completar el alta.' });
        expect(JSON.stringify(body)).not.toMatch(/existing@|ya existe|registrad|account|user/i);
    });

    it('fails closed on missing invitation authority without inventing HQ or franchise state', async () => {
        const rpc = vi.fn().mockResolvedValue({
            data: null,
            error: { code: 'P0001', message: 'INVITATION_AUTHORITY_INVALID' },
        });
        const createUser = vi.fn();
        const from = vi.fn();
        createServiceClientMock.mockReturnValue({
            rpc,
            from,
            auth: { admin: { createUser } },
        });
        const post = await loadProvisionPost();

        const response = await post(provisionRequest(validProvisionInput));
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body).toEqual({ success: false, error: 'No se pudo completar el alta.' });
        expect(createUser).not.toHaveBeenCalled();
        expect(from).not.toHaveBeenCalledWith('profiles');
        expect(from).not.toHaveBeenCalledWith('franchises');
        expect(JSON.stringify(body)).not.toMatch(/hq|franchise|authority/i);
    });
});

describe('ZIN-SDD-041 public invitation validation privacy (RED)', () => {
    it('returns a meaningful mask and localized label without raw authority or identity', async () => {
        const query = queryResult({
            id: invitationId,
            email: 'persona.sensible@example.test',
            role: 'agent',
            creator_id: adminId,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
        });
        createServiceClientMock.mockReturnValue({ from: vi.fn().mockReturnValue(query) });

        const result = await validateInvitationCode('ABCDEF12');

        expect(result).toEqual({
            valid: true,
            emailHint: 'p***@example.test',
            roleLabel: 'Colaborador comercial',
        });
        expect(JSON.stringify(result)).not.toContain('persona.sensible@example.test');
        expect(result).not.toHaveProperty('creator_id');
        expect(result).not.toHaveProperty('role');
    });
});
