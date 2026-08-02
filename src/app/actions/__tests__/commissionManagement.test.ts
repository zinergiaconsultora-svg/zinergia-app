import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireServerRoleMock = vi.fn();
const createClientMock = vi.fn();
const createServiceClientMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock('@/lib/auth/permissions', () => ({ requireServerRole: requireServerRoleMock }));
vi.mock('@/lib/supabase/server', () => ({ createClient: createClientMock }));
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: createServiceClientMock }));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

describe('commission management actions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        requireServerRoleMock.mockResolvedValue(undefined);
        createClientMock.mockResolvedValue({
            auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'admin-1' } } })) },
        });
    });

    it('creates a balanced direct-partner plan with zero franchise share', async () => {
        const rpc = vi.fn(async () => ({ data: { planId: 'plan-3' }, error: null }));
        createServiceClientMock.mockReturnValue({ rpc });

        const { createCommissionPlanAction } = await import('../commissionManagement');
        const result = await createCommissionPlanAction({
            channel: 'partner_direct',
            name: 'Socios directos',
            commercialPercent: 75,
            franchisePercent: 18,
        });

        expect(result).toEqual({ success: true, data: 'plan-3' });
        expect(rpc).toHaveBeenCalledWith('version_commission_plan', {
            p_actor_id: 'admin-1',
            p_channel: 'partner_direct',
            p_name: 'Socios directos',
            p_commercial_share_bps: 7500,
            p_franchise_share_bps: 0,
        });
    });

    it('rejects a franchise split above one hundred percent before writing', async () => {
        const { createCommissionPlanAction } = await import('../commissionManagement');
        const result = await createCommissionPlanAction({
            channel: 'franchise_network',
            name: 'Red franquiciada',
            commercialPercent: 70,
            franchisePercent: 40,
        });

        expect(result).toEqual({ success: false, error: 'El reparto debe sumar exactamente el 100 %.' });
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('assigns plans only through the protected database workflow', async () => {
        const rpc = vi.fn(async () => ({ data: 'assignment-1', error: null }));
        createServiceClientMock.mockReturnValue({ rpc });

        const { assignCommissionPlanAction } = await import('../commissionManagement');
        const result = await assignCommissionPlanAction({
            commercialId: '11111111-1111-4111-8111-111111111111',
            planId: '22222222-2222-4222-8222-222222222222',
            reason: 'Asignación inicial',
        });

        expect(result).toEqual({ success: true, data: 'assignment-1' });
        expect(rpc).toHaveBeenCalledWith('assign_commission_plan', {
            p_commercial_id: '11111111-1111-4111-8111-111111111111',
            p_plan_id: '22222222-2222-4222-8222-222222222222',
            p_actor_id: 'admin-1',
            p_reason: 'Asignación inicial',
        });
    });

    it('validates an eligible commission only through the protected lifecycle RPC', async () => {
        const rpc = vi.fn(async () => ({ data: 'validated', error: null }));
        createServiceClientMock.mockReturnValue({ rpc });

        const { validateCommissionAction } = await import('../commissionManagement');
        const result = await validateCommissionAction({
            commissionId: '11111111-1111-4111-8111-111111111111',
            reason: 'Contrato activo y liquidación conciliada',
        });

        expect(result).toEqual({ success: true, data: 'validated' });
        expect(rpc).toHaveBeenCalledWith('transition_commission_lifecycle', {
            p_commission_id: '11111111-1111-4111-8111-111111111111',
            p_to_status: 'validated',
            p_actor_id: 'admin-1',
            p_reason: 'Contrato activo y liquidación conciliada',
        });
    });

    it('resolves a decomission only through the protected adjustment RPC', async () => {
        const rpc = vi.fn(async () => ({ data: 'confirmed', error: null }));
        createServiceClientMock.mockReturnValue({ rpc });

        const { resolveCommissionAdjustmentAction } = await import('../commissionManagement');
        const result = await resolveCommissionAdjustmentAction({
            adjustmentId: '22222222-2222-4222-8222-222222222222',
            resolution: 'confirmed',
            note: 'Confirmado contra la liquidación de la comercializadora',
        });

        expect(result).toEqual({ success: true, data: 'confirmed' });
        expect(rpc).toHaveBeenCalledWith('resolve_commission_adjustment', {
            p_adjustment_id: '22222222-2222-4222-8222-222222222222',
            p_actor_id: 'admin-1',
            p_resolution: 'confirmed',
            p_note: 'Confirmado contra la liquidación de la comercializadora',
        });
    });

    it('proposes a permanence decomission without accepting a caller percentage', async () => {
        const rpc = vi.fn(async () => ({ data: 'adjustment-1', error: null }));
        createServiceClientMock.mockReturnValue({ rpc });

        const { proposePermanenceDecommissionAction } = await import('../commissionManagement');
        const result = await proposePermanenceDecommissionAction({
            commissionId: '11111111-1111-4111-8111-111111111111',
            terminationDate: '2026-08-01',
            evidenceReference: 'Liquidación agosto, línea 4',
        });

        expect(result).toEqual({ success: true, data: 'adjustment-1' });
        expect(rpc).toHaveBeenCalledWith('propose_permanence_decommission', {
            p_commission_id: '11111111-1111-4111-8111-111111111111',
            p_actor_id: 'admin-1',
            p_termination_date: '2026-08-01',
            p_evidence_reference: 'Liquidación agosto, línea 4',
        });
    });

    it('configures both channel models and selected partners through one RPC', async () => {
        const rpc = vi.fn(async () => ({
            data: {
                directPlanId: 'direct-plan',
                franchisePlanId: 'franchise-plan',
                assignedCount: 1,
            },
            error: null,
        }));
        createServiceClientMock.mockReturnValue({ rpc });

        const { setupCommissionModelAction } = await import('../commissionManagement');
        const result = await setupCommissionModelAction({
            directName: 'Socios directos',
            directCommercialPercent: 75,
            franchiseName: 'Red franquiciada',
            franchiseCommercialPercent: 45,
            franchisePercent: 15,
            directCommercialIds: ['11111111-1111-4111-8111-111111111111'],
        });

        expect(result).toEqual({
            success: true,
            data: {
                directPlanId: 'direct-plan',
                franchisePlanId: 'franchise-plan',
                assignedCount: 1,
            },
        });
        expect(rpc).toHaveBeenCalledWith('configure_commission_model', {
            p_actor_id: 'admin-1',
            p_direct_name: 'Socios directos',
            p_direct_commercial_share_bps: 7500,
            p_franchise_name: 'Red franquiciada',
            p_franchise_commercial_share_bps: 4500,
            p_franchise_share_bps: 1500,
            p_direct_commercial_ids: ['11111111-1111-4111-8111-111111111111'],
            p_reason: 'Configuración inicial del modelo económico',
        });
    });

    it('rejects an inverted channel model before opening a service connection', async () => {
        const { setupCommissionModelAction } = await import('../commissionManagement');
        const result = await setupCommissionModelAction({
            directName: 'Socios directos',
            directCommercialPercent: 55,
            franchiseName: 'Red franquiciada',
            franchiseCommercialPercent: 60,
            franchisePercent: 10,
            directCommercialIds: [],
        });

        expect(result.success).toBe(false);
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });

    it('creates a versioned decommission policy through one protected RPC', async () => {
        const rpc = vi.fn(async () => ({ data: 'policy-1', error: null }));
        createServiceClientMock.mockReturnValue({ rpc });

        const { createDecommissionPolicyAction } = await import('../commissionManagement');
        const result = await createDecommissionPolicyAction({
            marketerName: 'Naturgy',
            productCode: 'Luz 2.0TD',
            consolidationDays: 30,
            clawbackDays: 180,
            bands: [
                { activeDayFrom: 0, activeDayTo: 30, reversalPercent: 100 },
                { activeDayFrom: 31, activeDayTo: 90, reversalPercent: 50 },
                { activeDayFrom: 91, activeDayTo: 180, reversalPercent: 25 },
            ],
        });

        expect(result).toEqual({ success: true, data: 'policy-1' });
        expect(rpc).toHaveBeenCalledWith('configure_decommission_policy', {
            p_actor_id: 'admin-1',
            p_marketer_name: 'Naturgy',
            p_product_code: 'Luz 2.0TD',
            p_consolidation_days: 30,
            p_clawback_days: 180,
            p_bands: [
                { activeDayFrom: 0, activeDayTo: 30, reversalBps: 10000 },
                { activeDayFrom: 31, activeDayTo: 90, reversalBps: 5000 },
                { activeDayFrom: 91, activeDayTo: 180, reversalBps: 2500 },
            ],
        });
    });

    it('rejects a policy gap before writing', async () => {
        const { createDecommissionPolicyAction } = await import('../commissionManagement');
        const result = await createDecommissionPolicyAction({
            marketerName: 'Naturgy',
            productCode: '',
            consolidationDays: 30,
            clawbackDays: 180,
            bands: [
                { activeDayFrom: 0, activeDayTo: 30, reversalPercent: 100 },
                { activeDayFrom: 32, activeDayTo: 180, reversalPercent: 50 },
            ],
        });

        expect(result.success).toBe(false);
        expect(createServiceClientMock).not.toHaveBeenCalled();
    });
});
