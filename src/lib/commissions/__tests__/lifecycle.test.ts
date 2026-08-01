import { describe, expect, it } from 'vitest';
import {
    allocateGrossCommission,
    calculateCommissionReversal,
    canTransitionCommission,
    statusAfterReversal,
    validateCommissionPlan,
    validateDecommissionPolicy,
    type CommissionPlanInput,
} from '../lifecycle';

const DIRECT_PARTNER_PLAN: CommissionPlanInput = {
    channel: 'partner_direct',
    commercialShareBps: 7_500,
    franchiseShareBps: 0,
    centralShareBps: 2_500,
};

const FRANCHISE_NETWORK_PLAN: CommissionPlanInput = {
    channel: 'franchise_network',
    commercialShareBps: 4_000,
    franchiseShareBps: 1_500,
    centralShareBps: 4_500,
};

describe('commission plan allocation', () => {
    it('allocates a higher direct-partner share with no franchise amount', () => {
        expect(allocateGrossCommission(1_000, DIRECT_PARTNER_PLAN)).toEqual({
            grossAmount: 1_000,
            commercialAmount: 750,
            franchiseAmount: 0,
            centralAmount: 250,
        });
    });

    it('allocates an explicit franchise-network split', () => {
        expect(allocateGrossCommission(1_000, FRANCHISE_NETWORK_PLAN)).toEqual({
            grossAmount: 1_000,
            commercialAmount: 400,
            franchiseAmount: 150,
            centralAmount: 450,
        });
    });

    it('keeps cent rounding exactly balanced', () => {
        const allocation = allocateGrossCommission(123.45, FRANCHISE_NETWORK_PLAN);
        expect(
            allocation.commercialAmount + allocation.franchiseAmount + allocation.centralAmount,
        ).toBe(allocation.grossAmount);
    });

    it('rejects an unbalanced plan', () => {
        expect(validateCommissionPlan({
            ...FRANCHISE_NETWORK_PLAN,
            centralShareBps: 4_499,
        })).toContain('Commercial, franchise and central shares must total 10000 basis points.');
    });

    it('rejects franchise participation in a direct-partner plan', () => {
        expect(validateCommissionPlan({
            channel: 'partner_direct',
            commercialShareBps: 7_000,
            franchiseShareBps: 500,
            centralShareBps: 2_500,
        })).toContain('A direct-partner plan cannot allocate commission to a franchise.');
    });
});

describe('commission decommissioning', () => {
    const original = allocateGrossCommission(1_000, FRANCHISE_NETWORK_PLAN);

    it('creates a balanced partial reversal without mutating the original', () => {
        const reversal = calculateCommissionReversal(original, 5_000);
        expect(reversal).toEqual({
            reversalBps: 5_000,
            grossAmount: 500,
            commercialAmount: 200,
            franchiseAmount: 75,
            centralAmount: 225,
        });
        expect(original.grossAmount).toBe(1_000);
    });

    it('creates a full reversal using the frozen original allocation', () => {
        expect(calculateCommissionReversal(original, 10_000)).toEqual({
            reversalBps: 10_000,
            ...original,
        });
    });

    it('rejects an unbalanced original allocation', () => {
        expect(() => calculateCommissionReversal({
            grossAmount: 100,
            commercialAmount: 50,
            franchiseAmount: 10,
            centralAmount: 20,
        }, 5_000)).toThrow(/not balanced/);
    });

    it('accepts continuous non-increasing policy bands', () => {
        expect(validateDecommissionPolicy({
            consolidationDays: 30,
            clawbackDays: 180,
            bands: [
                { activeDayFrom: 0, activeDayTo: 30, reversalBps: 10_000 },
                { activeDayFrom: 31, activeDayTo: 90, reversalBps: 5_000 },
                { activeDayFrom: 91, activeDayTo: 180, reversalBps: 2_500 },
            ],
        })).toEqual([]);
    });

    it('rejects gaps and an uncovered policy window', () => {
        const errors = validateDecommissionPolicy({
            consolidationDays: 30,
            clawbackDays: 180,
            bands: [
                { activeDayFrom: 0, activeDayTo: 30, reversalBps: 10_000 },
                { activeDayFrom: 32, activeDayTo: 90, reversalBps: 5_000 },
            ],
        });

        expect(errors).toContain('Policy bands must be continuous and cover valid active-day ranges.');
        expect(errors).toContain('Policy bands must cover the full clawback window.');
    });

    it('rejects reversal percentages that increase over time', () => {
        expect(validateDecommissionPolicy({
            consolidationDays: 30,
            clawbackDays: 90,
            bands: [
                { activeDayFrom: 0, activeDayTo: 30, reversalBps: 5_000 },
                { activeDayFrom: 31, activeDayTo: 90, reversalBps: 7_500 },
            ],
        })).toContain('Band reversal cannot increase as active days advance.');
    });
});

describe('commission lifecycle', () => {
    it('allows only the forward operational sequence', () => {
        expect(canTransitionCommission('pending', 'eligible')).toBe(true);
        expect(canTransitionCommission('eligible', 'validated')).toBe(true);
        expect(canTransitionCommission('validated', 'invoiced')).toBe(true);
        expect(canTransitionCommission('invoiced', 'paid')).toBe(true);
    });

    it('does not allow skipping validation or moving backwards', () => {
        expect(canTransitionCommission('pending', 'invoiced')).toBe(false);
        expect(canTransitionCommission('paid', 'validated')).toBe(false);
    });

    it('keeps the operational status on a partial reversal', () => {
        expect(statusAfterReversal('paid', 2_500)).toBe('paid');
    });

    it('moves to reverted only when the full amount is reversed', () => {
        expect(statusAfterReversal('paid', 10_000)).toBe('reverted');
    });
});
