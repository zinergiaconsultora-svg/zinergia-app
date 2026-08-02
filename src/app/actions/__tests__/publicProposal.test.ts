import { beforeEach, describe, expect, it, vi } from 'vitest';

const serverFromMock = vi.fn();
const serverAuthGetUserMock = vi.fn();
const serviceFromMock = vi.fn();
const serviceRpcMock = vi.fn();
const headersMock = vi.fn();
const revalidatePathMock = vi.fn();
const requireServerRoleMock = vi.fn();
const getActiveCommissionRuleMock = vi.fn();
const calculateCommissionSplitMock = vi.fn();
const applyFranchiseOverrideMock = vi.fn();
const captureExceptionMock = vi.fn();
const loggerWarnMock = vi.fn();
const loggerErrorMock = vi.fn();
const finalizeAcceptedProposalSideEffectsMock = vi.fn();
const sendPushToUserMock = vi.fn();
const sendAgentAcceptanceEmailMock = vi.fn();
const sendClientAcceptanceEmailMock = vi.fn();

vi.mock('next/headers', () => ({ headers: headersMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

vi.mock('@/lib/supabase/server', () => ({
    createClient: vi.fn(async () => ({
        from: serverFromMock,
        auth: { getUser: serverAuthGetUserMock },
    })),
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: vi.fn(() => ({ from: serviceFromMock, rpc: serviceRpcMock })),
}));

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
}));

vi.mock('../commissionRules', () => ({
    getActiveCommissionRule: getActiveCommissionRuleMock,
}));

vi.mock('../proposals', () => ({
    finalizeAcceptedProposalSideEffects: finalizeAcceptedProposalSideEffectsMock,
}));

vi.mock('@/lib/push/sendPush', () => ({
    sendPushToUser: sendPushToUserMock,
}));

vi.mock('../email', () => ({
    sendAgentAcceptanceEmail: sendAgentAcceptanceEmailMock,
    sendClientAcceptanceEmail: sendClientAcceptanceEmailMock,
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
        serverAuthGetUserMock.mockReset();
        serviceFromMock.mockReset();
        serviceRpcMock.mockReset();
        headersMock.mockReset();
        headersMock.mockResolvedValue(new Headers({ 'x-forwarded-for': '203.0.113.10' }));
        requireServerRoleMock.mockResolvedValue(undefined);
        getActiveCommissionRuleMock.mockResolvedValue({});
        applyFranchiseOverrideMock.mockImplementation((rule) => rule);
        calculateCommissionSplitMock.mockReturnValue({ agent_commission: 10, franchise_profit: 2 });
        finalizeAcceptedProposalSideEffectsMock.mockResolvedValue(undefined);
        sendPushToUserMock.mockResolvedValue(undefined);
        sendAgentAcceptanceEmailMock.mockResolvedValue(undefined);
        sendClientAcceptanceEmailMock.mockResolvedValue(undefined);
    });

    it('does not query the database for invalid public proposal tokens', async () => {
        const { getPublicProposalAction } = await import('../publicProposal');

        const result = await getPublicProposalAction('not valid');

        expect(result).toBeNull();
        expect(serverFromMock).not.toHaveBeenCalled();
    });

    it('sends a proposal through the atomic opportunity workflow', async () => {
        const proposalQuery = selectQuery({
            data: { client_id: 'client-1', franchise_id: 'franchise-1' },
            error: null,
        });
        serverAuthGetUserMock.mockResolvedValue({ data: { user: { id: 'agent-1' } } });
        serverFromMock.mockReturnValue(proposalQuery);
        serviceRpcMock.mockResolvedValue({
            data: [{
                proposal_id: '11111111-1111-4111-8111-111111111111',
                opportunity_id: 'opportunity-1',
                owner_id: 'agent-1',
                outcome: 'sent',
                sent_at: '2026-06-30T10:00:00.000Z',
            }],
            error: null,
        });
        serviceFromMock.mockReturnValue(insertQuery());

        const { generatePublicLinkAction } = await import('../publicProposal');
        const result = await generatePublicLinkAction('11111111-1111-4111-8111-111111111111');

        expect(result.url).toMatch(/\/p\/[A-Za-z0-9_-]{32,64}$/);
        expect(serviceRpcMock).toHaveBeenCalledWith('send_crm_proposal', expect.objectContaining({
            p_proposal_id: '11111111-1111-4111-8111-111111111111',
            p_actor_id: 'agent-1',
            p_public_token: expect.stringMatching(/^[A-Za-z0-9_-]{32,64}$/),
            p_public_expires_at: expect.any(String),
        }));
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

    it('accepts through the atomic opportunity RPC and writes safe activity metadata', async () => {
        serviceRpcMock.mockResolvedValue({
            data: [{
                proposal_id: 'proposal-1',
                opportunity_id: 'opportunity-1',
                owner_id: 'agent-1',
                outcome: 'accepted_now',
                accepted_at: '2026-06-30T10:00:00.000Z',
            }],
            error: null,
        });
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
                id: 'proposal-1',
                client_id: 'client-1',
                agent_id: 'agent-1',
                franchise_id: 'franchise-1',
                status: 'accepted',
                created_at: '2026-06-30T10:00:00.000Z',
                updated_at: '2026-06-30T10:01:00.000Z',
                annual_savings: null,
                savings_percent: 20,
                current_annual_cost: 1200,
                offer_annual_cost: 900,
                offer_snapshot: { marketer_name: 'Zin Tarifa', tariff_name: 'Plan' },
                calculation_data: null,
                source_tariff_id: null,
                source_proposal_id: null,
                proposal_version: 1,
                price_snapshot: null,
                price_snapshot_at: null,
                pricing_status: 'locked',
                repriced_at: null,
                repricing_delta_eur: null,
                notes: null,
                optimization_result: null,
                aletheia_summary: null,
                ocr_job_id: null,
                opportunity_id: 'opportunity-1',
                supply_point_id: 'supply-1',
                clients: { name: 'Cliente Demo', email: null },
            },
            error: null,
        });
        const profileContext = selectQuery({
            data: { id: 'agent-1', email: 'agent@example.com', franchise_id: 'franchise-1' },
            error: null,
        });
        const proposalQueries = [activityContext, proposalContext];
        const activityInsert = insertQuery();

        serviceFromMock.mockImplementation((table: string) => {
            if (table === 'proposals') {
                return { select: vi.fn(() => proposalQueries.shift()) };
            }
            if (table === 'profiles') return { select: vi.fn(() => profileContext) };
            if (table === 'client_activities') return activityInsert;
            return insertQuery();
        });

        const { acceptPublicProposalAction } = await import('../publicProposal');

        const result = await acceptPublicProposalAction(validToken, validSignature, ' Maria Garcia ');

        expect(result).toEqual({
            success: true,
            message: '¡Propuesta aceptada! Tu asesor se pondrá en contacto contigo.',
        });
        expect(serviceRpcMock).toHaveBeenCalledWith('accept_crm_public_proposal', {
            p_public_token: validToken,
            p_signature_data: validSignature,
            p_signed_name: 'Maria Garcia',
        });
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
        expect(finalizeAcceptedProposalSideEffectsMock).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ id: 'proposal-1', status: 'accepted', agent_id: 'agent-1' }),
            'agent-1',
        );
    });

    it('returns stable success for already accepted proposals without repeating side effects', async () => {
        serviceRpcMock.mockResolvedValue({
            data: [{
                proposal_id: 'proposal-1',
                opportunity_id: 'opportunity-1',
                owner_id: 'agent-1',
                outcome: 'already_accepted',
                accepted_at: '2026-06-30T10:00:00.000Z',
            }],
            error: null,
        });
        const { acceptPublicProposalAction } = await import('../publicProposal');

        const result = await acceptPublicProposalAction(validToken, validSignature, 'Maria Garcia');

        expect(result).toEqual({
            success: true,
            message: 'Esta propuesta ya fue aceptada anteriormente.',
        });
        expect(serviceFromMock).not.toHaveBeenCalled();
        expect(finalizeAcceptedProposalSideEffectsMock).not.toHaveBeenCalled();
    });

    it('keeps the expired-link response without exposing database details', async () => {
        serviceRpcMock.mockResolvedValue({
            data: null,
            error: { message: 'proposal link expired', code: 'P0001' },
        });
        const { acceptPublicProposalAction } = await import('../publicProposal');

        const result = await acceptPublicProposalAction(validToken, validSignature, 'Maria Garcia');

        expect(result).toEqual({
            success: false,
            message: 'El enlace ha expirado. Contacta con tu asesor.',
        });
        expect(result.message).not.toContain(validToken);
    });

    it('runs durable side effects once when two acceptance requests race', async () => {
        serviceRpcMock
            .mockResolvedValueOnce({
                data: [{
                    proposal_id: 'proposal-1',
                    opportunity_id: 'opportunity-1',
                    owner_id: 'agent-1',
                    outcome: 'accepted_now',
                    accepted_at: '2026-06-30T10:00:00.000Z',
                }],
                error: null,
            })
            .mockResolvedValueOnce({
                data: [{
                    proposal_id: 'proposal-1',
                    opportunity_id: 'opportunity-1',
                    owner_id: 'agent-1',
                    outcome: 'already_accepted',
                    accepted_at: '2026-06-30T10:00:00.000Z',
                }],
                error: null,
            });

        const activityContext = selectQuery({
            data: { client_id: 'client-1', agent_id: 'agent-1', franchise_id: 'franchise-1' },
            error: null,
        });
        const proposalContext = selectQuery({
            data: {
                id: 'proposal-1', client_id: 'client-1', agent_id: 'agent-1',
                franchise_id: 'franchise-1', opportunity_id: 'opportunity-1',
                supply_point_id: 'supply-1', status: 'accepted',
                clients: { name: 'Cliente Demo', email: null },
            },
            error: null,
        });
        const profileContext = selectQuery({
            data: { id: 'agent-1', email: null, franchise_id: 'franchise-1' },
            error: null,
        });
        const proposalQueries = [activityContext, proposalContext];
        serviceFromMock.mockImplementation((table: string) => {
            if (table === 'proposals') return { select: vi.fn(() => proposalQueries.shift()) };
            if (table === 'profiles') return { select: vi.fn(() => profileContext) };
            return insertQuery();
        });

        const { acceptPublicProposalAction } = await import('../publicProposal');
        const results = await Promise.all([
            acceptPublicProposalAction(validToken, validSignature, 'Maria Garcia'),
            acceptPublicProposalAction(validToken, validSignature, 'Maria Garcia'),
        ]);

        expect(results.every((result) => result.success)).toBe(true);
        expect(finalizeAcceptedProposalSideEffectsMock).toHaveBeenCalledTimes(1);
        expect(finalizeAcceptedProposalSideEffectsMock).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({
                id: 'proposal-1',
                opportunity_id: 'opportunity-1',
                agent_id: 'agent-1',
            }),
            'agent-1',
        );
    });
});
