import { describe, expect, it } from 'vitest';
import {
    buildCommissionWorkspace,
    type CommissionWorkspaceSource,
} from '../workspace';

const baseCommission: CommissionWorkspaceSource = {
    id: 'commission-1',
    proposal_id: 'proposal-1',
    contract_id: 'contract-1',
    created_at: '2026-07-01T10:00:00.000Z',
    lifecycle_status: 'validated',
    reconciliation_status: 'ready',
    agent_commission: 400,
    commercial_net_amount: 400,
    gross_supplier_commission: 1_000,
    total_reversed_commercial: 0,
    calculation_snapshot: {
        marketer_name: 'Comercializadora Norte',
        product_code: '2.0TD FIJA',
    },
    policy_snapshot: {
        code: 'NORTE-2026',
        version: 2,
    },
    clients: { name: 'Panaderia Sol' },
    proposals: {
        offer_snapshot: { marketer_name: 'Comercializadora Norte' },
        clients: { name: 'Panaderia Sol' },
    },
    commission_adjustments: [],
};

describe('commission workspace', () => {
    it('groups all six lifecycle states and totals the commercial net amount', () => {
        const statuses = ['pending', 'eligible', 'validated', 'invoiced', 'paid', 'reverted'] as const;
        const workspace = buildCommissionWorkspace(statuses.map((status, index) => ({
            ...baseCommission,
            id: `commission-${index}`,
            lifecycle_status: status,
            commercial_net_amount: 100 + index,
        })));

        expect(workspace.statuses.map((status) => status.id)).toEqual(statuses);
        expect(workspace.statuses.map((status) => status.count)).toEqual([1, 1, 1, 1, 1, 1]);
        expect(workspace.totalNetAmount).toBe(615);
        expect(workspace.availableToInvoiceAmount).toBe(102);
    });

    it('shows original, reversed and remaining amounts without mutating history', () => {
        const workspace = buildCommissionWorkspace([{
            ...baseCommission,
            lifecycle_status: 'paid',
            total_reversed_commercial: 150,
            commission_adjustments: [{
                id: 'adjustment-1',
                reason_code: 'early_switch',
                active_days: 42,
                reversal_bps: 3_750,
                commercial_amount: 150,
                evidence_reference: 'liquidacion-julio-linea-18',
                policy_snapshot: { code: 'NORTE-2026', version: 2 },
                status: 'disputed',
                proposed_at: '2026-07-20T10:00:00.000Z',
                resolved_at: null,
                resolution_note: null,
            }],
        }]);

        expect(workspace.items[0]).toMatchObject({
            originalAmount: 400,
            reversedAmount: 150,
            netAmount: 250,
            marketerName: 'Comercializadora Norte',
            productName: '2.0TD FIJA',
        });
        expect(workspace.items[0].adjustments[0]).toMatchObject({
            reasonLabel: 'Cambio anticipado de comercializadora',
            activeDays: 42,
            reversedAmount: 150,
            evidenceReference: 'liquidacion-julio-linea-18',
            disputeLabel: 'En disputa',
            frozenPolicyLabel: 'NORTE-2026 v2',
        });
    });

    it('falls back to the legacy amount and exposes reconciliation blockers', () => {
        const workspace = buildCommissionWorkspace([{
            ...baseCommission,
            commercial_net_amount: null,
            agent_commission: 275.5,
            reconciliation_status: 'plan_unassigned',
            clients: null,
        }]);

        expect(workspace.items[0].originalAmount).toBe(275.5);
        expect(workspace.items[0].clientName).toBe('Panaderia Sol');
        expect(workspace.items[0].reconciliationLabel).toBe('Falta asignar el plan comercial');
    });
});
