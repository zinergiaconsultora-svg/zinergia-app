import { describe, expect, it } from 'vitest';
import {
    buildCommissionAdminQueues,
    type AdminCommissionSource,
} from '../adminQueues';

const base: AdminCommissionSource = {
    id: 'commission-1',
    agent_id: 'agent-1',
    proposal_id: 'proposal-1',
    lifecycle_status: 'eligible',
    reconciliation_status: 'ready',
    commercial_net_amount: 400,
    agent_commission: 400,
    total_reversed_commercial: 0,
    invoice_id: null,
    created_at: '2026-08-01T08:00:00.000Z',
    eligible_at: '2026-08-01T09:00:00.000Z',
    validated_at: null,
    clients: { name: 'Taller Norte' },
    proposals: { clients: { name: 'Taller Norte' } },
    commercial: {
        full_name: 'Ana Comercial',
        email: 'ana@example.test',
        company_name: 'Ana Energía SL',
        fiscal_verified: true,
    },
};

describe('commission admin queues', () => {
    it('separates validation and settlement without duplicate inclusion', () => {
        const queues = buildCommissionAdminQueues({
            commissions: [
                base,
                { ...base, id: 'commission-2', lifecycle_status: 'validated', validated_at: '2026-08-02T09:00:00.000Z' },
                { ...base, id: 'commission-3', lifecycle_status: 'validated', invoice_id: 'invoice-1' },
                { ...base, id: 'commission-4', reconciliation_status: 'policy_unmatched' },
            ],
            adjustments: [],
            reconciliation: [],
        });

        expect(queues.validation.map((item) => item.id)).toEqual(['commission-1']);
        expect(queues.settlement.map((item) => item.id)).toEqual(['commission-2']);
        expect(queues.validation[0]).toMatchObject({
            commercialName: 'Ana Comercial',
            clientName: 'Taller Norte',
            netAmount: 400,
        });
    });

    it('calculates the payable net after confirmed reversals', () => {
        const queues = buildCommissionAdminQueues({
            commissions: [{
                ...base,
                lifecycle_status: 'validated',
                total_reversed_commercial: 125.5,
            }],
            adjustments: [],
            reconciliation: [],
        });

        expect(queues.settlement[0]).toMatchObject({
            originalAmount: 400,
            reversedAmount: 125.5,
            netAmount: 274.5,
            fiscalReady: true,
        });
    });

    it('combines proposed adjustments and reconciliation blockers', () => {
        const queues = buildCommissionAdminQueues({
            commissions: [base],
            adjustments: [{
                id: 'adjustment-1',
                commission_id: 'commission-1',
                reason_code: 'early_switch',
                active_days: 35,
                reversal_bps: 5_000,
                commercial_amount: 200,
                evidence_reference: 'liquidacion-agosto-linea-4',
                status: 'proposed',
                proposed_at: '2026-08-03T08:00:00.000Z',
            }],
            reconciliation: [{
                commissionId: 'commission-9',
                commercialId: 'agent-9',
                lifecycleStatus: 'pending',
                reconciliationStatus: 'plan_unassigned',
                requiredAction: 'Asignar plan económico',
                createdAt: '2026-08-01T08:00:00.000Z',
            }],
        });

        expect(queues.adjustments[0]).toMatchObject({
            id: 'adjustment-1',
            commissionId: 'commission-1',
            causeLabel: 'Cambio anticipado de comercializadora',
            activeDays: 35,
            reversedAmount: 200,
        });
        expect(queues.reconciliation[0].requiredAction).toBe('Asignar plan económico');
        expect(queues.attentionCount).toBe(2);
    });
});
