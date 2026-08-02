import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireServerRoleMock = vi.fn();
const createClientMock = vi.fn();
const createServiceClientMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@/lib/auth/permissions', () => ({
    requireServerRole: requireServerRoleMock,
}));

vi.mock('@/lib/supabase/server', () => ({
    createClient: createClientMock,
}));

vi.mock('@/lib/supabase/service', () => ({
    createServiceClient: createServiceClientMock,
}));

vi.mock('next/cache', () => ({
    revalidatePath: revalidatePathMock,
}));

const validInput = {
    opportunityId: '00000000-0000-4000-8000-000000000001',
    expectedStage: 'data_review' as const,
    toStage: 'proposal_preparation' as const,
    reasonCode: 'ocr_confirmed' as const,
    nextActionDueAt: '2026-08-01T10:00:00.000Z',
};

describe('transitionOpportunityAction', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({
                    data: { user: { id: '00000000-0000-4000-8000-000000000002' } },
                })),
            },
        });
    });

    it('authorizes before creating any database client', async () => {
        requireServerRoleMock.mockRejectedValue(new Error('Forbidden'));
        const { transitionOpportunityAction } = await import('../opportunities');

        await expect(transitionOpportunityAction(validInput)).rejects.toThrow('Forbidden');

        expect(createClientMock).not.toHaveBeenCalled();
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('does not use service role without a validated session user', async () => {
        createClientMock.mockResolvedValue({
            auth: {
                getUser: vi.fn(async () => ({ data: { user: null } })),
            },
        });
        const { transitionOpportunityAction } = await import('../opportunities');

        await expect(transitionOpportunityAction(validInput)).resolves.toEqual({
            ok: false,
            error: 'UNAUTHENTICATED',
        });
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('rejects skipped transitions before calling the service role', async () => {
        const { transitionOpportunityAction } = await import('../opportunities');

        await expect(transitionOpportunityAction({
            ...validInput,
            expectedStage: 'invoice_received',
            toStage: 'proposal_sent',
        })).resolves.toEqual({
            ok: false,
            error: 'TRANSITION_REJECTED',
        });
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('calls the atomic RPC with fixed safe metadata and current actor', async () => {
        const rpc = vi.fn(async () => ({
            data: {
                id: validInput.opportunityId,
                client_id: '00000000-0000-4000-8000-000000000003',
                supply_point_id: '00000000-0000-4000-8000-000000000004',
                owner_id: '00000000-0000-4000-8000-000000000002',
                stage: 'proposal_preparation',
                stage_entered_at: '2026-07-31T01:00:00.000Z',
                next_action_type: 'compare_tariffs',
                next_action_title: 'Comparar tarifas',
                next_action_due_at: validInput.nextActionDueAt,
                closed_at: null,
            },
            error: null,
        }));
        createServiceClientMock.mockReturnValue({ rpc });
        const { transitionOpportunityAction } = await import('../opportunities');

        const result = await transitionOpportunityAction(validInput);

        expect(result).toMatchObject({
            ok: true,
            opportunity: {
                id: validInput.opportunityId,
                stage: 'proposal_preparation',
                nextActionType: 'compare_tariffs',
            },
        });
        expect(rpc).toHaveBeenCalledWith('transition_crm_opportunity', {
            p_opportunity_id: validInput.opportunityId,
            p_expected_stage: 'data_review',
            p_to_stage: 'proposal_preparation',
            p_actor_id: '00000000-0000-4000-8000-000000000002',
            p_reason_code: 'ocr_confirmed',
            p_safe_metadata: { source: 'authenticated_server_action' },
            p_next_action_due_at: validInput.nextActionDueAt,
            p_loss_reason: null,
        });
        expect(revalidatePathMock).toHaveBeenCalledWith('/dashboard');
    });

    it.each([
        ['42501', 'NOT_AUTHORIZED'],
        ['P0002', 'NOT_AVAILABLE'],
        ['40001', 'STATE_CHANGED'],
        ['22023', 'TRANSITION_REJECTED'],
        ['XX000', 'PERSISTENCE_FAILED'],
    ] as const)('maps database code %s without returning raw messages', async (code, expected) => {
        createServiceClientMock.mockReturnValue({
            rpc: vi.fn(async () => ({
                data: null,
                error: { code, message: 'raw database detail' },
            })),
        });
        const { transitionOpportunityAction } = await import('../opportunities');

        await expect(transitionOpportunityAction(validInput)).resolves.toEqual({
            ok: false,
            error: expected,
        });
    });
});

describe('getOpportunityWorkspaceAction', () => {
    const opportunityId = '00000000-0000-4000-8000-000000000010';
    const clientId = '00000000-0000-4000-8000-000000000011';
    const supplyPointId = '00000000-0000-4000-8000-000000000012';
    const ownerId = '00000000-0000-4000-8000-000000000013';

    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
    });

    function createWorkspaceClient() {
        const eqCalls: Array<[string, string, string]> = [];
        const singles: Record<string, unknown> = {
            opportunities: {
                id: opportunityId,
                client_id: clientId,
                supply_point_id: supplyPointId,
                owner_id: ownerId,
                type: 'switch',
                stage: 'data_review',
                stage_entered_at: '2026-07-31T10:00:00.000Z',
                next_action_type: 'review_invoice',
                next_action_title: 'Revisar factura',
                next_action_due_at: null,
                loss_reason: null,
            },
            clients: {
                id: clientId,
                name: 'Cliente Norte',
                email: null,
                phone: null,
                status: 'in_process',
            },
            supply_points: {
                id: supplyPointId,
                client_id: clientId,
                supply_type: 'electricity',
                cups_last4: 'AA1F',
                address: null,
                city: null,
                current_marketer: null,
                current_tariff: null,
                annual_consumption_kwh: null,
            },
            profiles: { id: ownerId, full_name: 'Ana Comercial' },
        };
        const lists: Record<string, unknown[]> = {
            ocr_jobs: [],
            proposals: [],
            contracts: [],
            network_commissions: [],
            tasks: [],
            opportunity_stage_history: [],
        };
        const from = vi.fn((table: string) => ({
            select: vi.fn(() => {
                const query = {
                    eq: vi.fn((column: string, value: string) => {
                        eqCalls.push([table, column, value]);
                        return query;
                    }),
                    maybeSingle: vi.fn(async () => ({
                        data: singles[table] ?? null,
                        error: null,
                    })),
                    order: vi.fn(async () => ({
                        data: lists[table] ?? [],
                        error: null,
                    })),
                };
                return query;
            }),
        }));

        return { client: { from }, eqCalls };
    }

    it('authorizes before reading the opportunity', async () => {
        requireServerRoleMock.mockRejectedValue(new Error('Forbidden'));
        const { getOpportunityWorkspaceAction } = await import('../opportunities');

        await expect(getOpportunityWorkspaceAction(opportunityId)).rejects.toThrow('Forbidden');
        expect(createClientMock).not.toHaveBeenCalled();
    });

    it('loads every related collection through the canonical opportunity id', async () => {
        const { client, eqCalls } = createWorkspaceClient();
        createClientMock.mockResolvedValue(client);
        const { getOpportunityWorkspaceAction } = await import('../opportunities');

        const result = await getOpportunityWorkspaceAction(opportunityId);

        expect(result).toMatchObject({
            id: opportunityId,
            client: { id: clientId },
            supplyPoint: { id: supplyPointId },
        });
        for (const table of [
            'ocr_jobs',
            'proposals',
            'contracts',
            'network_commissions',
            'tasks',
            'opportunity_stage_history',
        ]) {
            expect(eqCalls).toContainEqual([table, 'opportunity_id', opportunityId]);
        }
    });
});
