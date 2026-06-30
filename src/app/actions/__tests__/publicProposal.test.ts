import { beforeEach, describe, expect, it, vi } from 'vitest';

const serverFromMock = vi.fn();
const serviceFromMock = vi.fn();
const headersMock = vi.fn();
const revalidatePathMock = vi.fn();
const requireServerRoleMock = vi.fn();
const getActiveCommissionRuleMock = vi.fn();
const calculateCommissionSplitMock = vi.fn();
const applyFranchiseOverrideMock = vi.fn();
const captureExceptionMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();

vi.mock('next/headers', () => ({ headers: headersMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({ from: serverFromMock })),
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: vi.fn(() => ({ from: serviceFromMock })),
}));

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
}));

vi.mock('../commissionRules', () => ({
    getActiveCommissionRule: getActiveCommissionRuleMock,
}));

vi.mock('@/lib/commissions/calculator', () => ({
    calculateCommissionSplit: calculateCommissionSplitMock,
    applyFranchiseOverride: applyFranchiseOverrideMock,
}));

vi.mock('@/lib/logger', () => ({
    moduleLogger: vi.fn(() => ({
        warn: loggerWarnMock,
        error: loggerErrorMock,
    })),
}));

vi.mock('@sentry/nextjs', () => ({
    captureException: captureExceptionMock,
}));

function selectQuery(result: unknown) {
    const query = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        maybeSingle: vi.fn(async () => result),
    };
    return query;
}

function updateQuery(result: unknown) {
    const query = {
        update: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        select: vi.fn(() => query),
        maybeSingle: vi.fn(async () => result),
    };
    return query;
}

function insertQuery(result: unknown = { error: null }) {
    return {
        insert: vi.fn(async () => result),
    };
}

const validToken = 'abcdefghijklmnopqrstuvwxyzABCDEFGH123456789';
const validSignature = `data:image/png;base64,${'a'.repeat(32)}`;

describe('public proposal actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        serverFromMock.mockReset();
        serviceFromMock.mockReset();
        headersMock.mockReset();
        headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.10' }));
        requireServerRoleMock.mockResolvedValue(undefined);
        getActiveCommissionRuleMock.mockResolvedValue({});
        applyFranchiseOverrideMock.mockImplementation((rule) => rule);
        calculateCommissionSplitMock.mockReturnValue({ agent_commission: 10, franchise_profit: 2 });
    });

    it('does not query the database for invalid public proposal tokens', async () => {
        const { getPublicProposalAction } = await import('../publicProposal');

        const result = await getPublicProposalAction('not valid');

        expect(result).toBeNull();
        expect(serverFromMock).not.toHaveBeenCalled();
    });

    it('rejects invalid acceptance tokens with a generic message before service-role work', async () => {
        const { acceptPublicProposalAction } = await import('../publicProposal');

        const result = await acceptPublicProposalAction('not valid', validSignature, 'Maria Garcia');

        expect(result).toEqual({
            success: false,
            message: 'No hemos podido abrir esta propuesta. Contacta con tu asesor.',
        });
        expect(serviceFromMock).not.toHaveBeenCalled();
    });

    it('reads a narrow public proposal shape without calculation_data or internal ids', async () => {
        const proposalQuery = selectQuery({
            data: {
                id: 'proposal-1',
                status: 'sent',
                created_at: '2026-06-30T10:00:00.000Z',
                public_expires_at: '2099-01-01T00:00:00.000Z',
                public_accepted_at: null,
                offer_snapshot: { marketer_name: 'Zin Tarifa', tariff_name: 'Plan', type: 'fixed' },
                current_annual_cost: 1200,
                offer_annual_cost: 900,
                annual_savings: 300,
                savings_percent: 25,
                notes: null,
                optimization_result: null,
                aletheia_summary: null,
                clients: { name: 'Cliente Demo' },
            },
            error: null,
        });
        serverFromMock.mockReturnValue(proposalQuery);
        const { getPublicProposalAction } = await import('../publicProposal');

        const result = await getPublicProposalAction(validToken);

        expect(result).toMatchObject({ id: 'proposal-1', client_name: 'Cliente Demo' });
        expect(result).not.toHaveProperty('calculation_data');
        expect(result).not.toHaveProperty('agent_id');
        expect(result).not.toHaveProperty('franchise_id');
        expect(result).not.toHaveProperty('public_token');
        const selectArg = (proposalQuery.select.mock.calls as unknown as string[][])[0][0];
        expect(selectArg).not.toContain('calculation_data');
        expect(selectArg).not.toContain('agent_id');
        expect(selectArg).not.toContain('franchise_id');
        expect(selectArg).not.toContain('public_token');
    });

    it('rejects missing signature or signer name before service-role work', async () => {
        const { acceptPublicProposalAction } = await import('../publicProposal');

        await expect(acceptPublicProposalAction(validToken, undefined, 'Maria')).resolves.toEqual({
            success: false,
            message: 'Revisa la firma y el nombre antes de continuar.',
        });
        await expect(acceptPublicProposalAction(validToken, validSignature, ' ')).resolves.toEqual({
            success: false,
            message: 'Revisa la firma y el nombre antes de continuar.',
        });
        expect(serviceFromMock).not.toHaveBeenCalled();
    });

    it('rejects invalid signature payloads before service-role work', async () => {
        const { acceptPublicProposalAction } = await import('../publicProposal');

        const result = await acceptPublicProposalAction(validToken, 'data:image/svg+xml;base64,abc', 'Maria');

        expect(result).toEqual({
            success: false,
            message: 'Revisa la firma y el nombre antes de continuar.',
        });
        expect(serviceFromMock).not.toHaveBeenCalled();
    });

    it('updates acceptance atomically and writes safe activity metadata', async () => {
        const proposalFetch = selectQuery({
            data: {
                id: 'proposal-1',
                status: 'sent',
                public_expires_at: '2099-01-01T00:00:00.000Z',
                public_accepted_at: null,
            },
            error: null,
        });
        const proposalUpdate = updateQuery({ data: { id: 'proposal-1' }, error: null });
        const activityContext = selectQuery({
            data: {
                client_id: 'client-1',
                agent_id: 'agent-1',
                franchise_id: 'franchise-1',
            },
            error: null,
        });
        const proposalContext = selectQuery({
            data: {
                annual_savings: null,
                savings_percent: 20,
                offer_annual_cost: 900,
                offer_snapshot: { marketer_name: 'Zin Tarifa', tariff_name: 'Plan' },
                clients: { name: 'Cliente Demo', email: null },
                profiles: null,
            },
            error: null,
        });
        const proposalQueries = [proposalFetch, activityContext, proposalContext];
        const activityInsert = insertQuery();

        serviceFromMock.mockImplementation((table: string) => {
            if (table === 'proposals') {
                return {
                    select: vi.fn(() => proposalQueries.shift()),
                    update: proposalUpdate.update,
                };
            }
            if (table === 'client_activities') return activityInsert;
            return insertQuery();
        });

        const { acceptPublicProposalAction } = await import('../publicProposal');

        const result = await acceptPublicProposalAction(validToken, validSignature, ' Maria Garcia ');

        expect(result).toEqual({
            success: true,
            message: '¡Propuesta aceptada! Tu asesor se pondrá en contacto contigo.',
        });
        expect(proposalUpdate.update).toHaveBeenCalledWith(expect.objectContaining({
            status: 'accepted',
            pricing_status: 'locked',
            signature_data: validSignature,
            signed_name: 'Maria Garcia',
        }));
        expect(proposalUpdate.eq).toHaveBeenCalledWith('status', 'sent');
        expect(proposalUpdate.is).toHaveBeenCalledWith('public_accepted_at', null);
        expect(activityInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
            client_id: 'client-1',
            type: 'proposal_accepted',
            metadata: expect.objectContaining({
                proposal_id: 'proposal-1',
                source: 'public_portal',
                accepted_at: expect.any(String),
            }),
        }));
        const metadata = (activityInsert.insert.mock.calls as unknown as Array<Array<{ metadata: Record<string, unknown> }>>)[0][0].metadata;
        expect(metadata).not.toHaveProperty('token');
        expect(metadata).not.toHaveProperty('signature_data');
        expect(metadata).not.toHaveProperty('ip');
        expect(metadata).not.toHaveProperty('user_agent');
    });

    it('returns stable success for already accepted proposals without updating', async () => {
        const proposalFetch = selectQuery({
            data: {
                id: 'proposal-1',
                status: 'accepted',
                public_expires_at: '2099-01-01T00:00:00.000Z',
                public_accepted_at: '2026-06-30T10:00:00.000Z',
            },
            error: null,
        });
        serviceFromMock.mockImplementation((table: string) => {
            if (table === 'proposals') return { select: vi.fn(() => proposalFetch) };
            return insertQuery();
        });
        const { acceptPublicProposalAction } = await import('../publicProposal');

        const result = await acceptPublicProposalAction(validToken, validSignature, 'Maria Garcia');

        expect(result).toEqual({
            success: true,
            message: 'Esta propuesta ya fue aceptada anteriormente.',
        });
        expect(serviceFromMock).toHaveBeenCalledWith('proposals');
    });
});
