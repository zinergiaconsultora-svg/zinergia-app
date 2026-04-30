import { describe, expect, it } from 'vitest';
import {
    applyFranchiseOverride,
    calculateCommissionSplit,
    validateCommissionRule,
    type CommissionRuleInput,
} from '../calculator';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Default rule matching the seeded production config. */
const DEFAULT_RULE: CommissionRuleInput = {
    commission_rate: 0.15,   // 15% of annual savings
    agent_share: 0.30,       // 30% to agent
    franchise_share: 0.50,   // 50% to franchise
    hq_share: 0.20,          // 20% to HQ
    points_per_win: 50,
};

// ---------------------------------------------------------------------------
// calculateCommissionSplit
// ---------------------------------------------------------------------------

describe('calculateCommissionSplit', () => {
    it('calculates the correct pot from annual savings', () => {
        const result = calculateCommissionSplit(1000, DEFAULT_RULE);
        // pot = 1000 × 0.15 = 150
        expect(result.pot).toBe(150);
    });

    it('splits the pot correctly between agent, franchise, and HQ', () => {
        const result = calculateCommissionSplit(1000, DEFAULT_RULE);
        // pot = 150
        expect(result.agent_commission).toBe(45);    // 150 × 0.30
        expect(result.franchise_profit).toBe(75);    // 150 × 0.50
        expect(result.hq_royalty).toBe(30);          // 150 × 0.20
    });

    it('agent + franchise + hq sums to pot (within 1 cent)', () => {
        const result = calculateCommissionSplit(1337.99, DEFAULT_RULE);
        const sum = result.agent_commission + result.franchise_profit + result.hq_royalty;
        // Rounding can cause ±0.01 difference
        expect(Math.abs(sum - result.pot)).toBeLessThanOrEqual(0.01);
    });

    it('returns the points_per_win from the rule', () => {
        const result = calculateCommissionSplit(1000, DEFAULT_RULE);
        expect(result.points).toBe(50);
    });

    it('handles zero annual savings (no commission)', () => {
        const result = calculateCommissionSplit(0, DEFAULT_RULE);
        expect(result.pot).toBe(0);
        expect(result.agent_commission).toBe(0);
        expect(result.franchise_profit).toBe(0);
        expect(result.hq_royalty).toBe(0);
    });

    it('rounds amounts to 2 decimal places', () => {
        // 333.33 × 0.15 = 49.9995 → rounds to 50.00
        const result = calculateCommissionSplit(333.33, DEFAULT_RULE);
        expect(result.pot.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
        expect(result.agent_commission.toString()).toMatch(/^\d+(\.\d{1,2})?$/);
    });

    it('works with a 100% commission rate', () => {
        const fullRate: CommissionRuleInput = { ...DEFAULT_RULE, commission_rate: 1.0 };
        const result = calculateCommissionSplit(200, fullRate);
        expect(result.pot).toBe(200);
    });

    it('works with unequal share split (e.g. agent-heavy)', () => {
        const agentHeavy: CommissionRuleInput = {
            commission_rate: 0.20,
            agent_share: 0.70,
            franchise_share: 0.20,
            hq_share: 0.10,
            points_per_win: 100,
        };
        const result = calculateCommissionSplit(500, agentHeavy);
        expect(result.pot).toBe(100);          // 500 × 0.20
        expect(result.agent_commission).toBe(70); // 100 × 0.70
        expect(result.franchise_profit).toBe(20); // 100 × 0.20
        expect(result.hq_royalty).toBe(10);       // 100 × 0.10
    });

    it('throws on negative annual savings', () => {
        expect(() => calculateCommissionSplit(-1, DEFAULT_RULE)).toThrow(/annualSavings/);
    });

    it('throws when rule is invalid (shares do not sum to 1)', () => {
        const bad: CommissionRuleInput = { ...DEFAULT_RULE, agent_share: 0.99 };
        expect(() => calculateCommissionSplit(1000, bad)).toThrow(/Invalid commission rule/);
    });
});

// ---------------------------------------------------------------------------
// validateCommissionRule
// ---------------------------------------------------------------------------

describe('validateCommissionRule', () => {
    it('returns no errors for a valid default rule', () => {
        expect(validateCommissionRule(DEFAULT_RULE)).toHaveLength(0);
    });

    it('accepts shares that sum to exactly 1', () => {
        const rule = { ...DEFAULT_RULE, agent_share: 1/3, franchise_share: 1/3, hq_share: 1/3 };
        expect(validateCommissionRule(rule)).toHaveLength(0);
    });

    it('accepts shares within the 0.001 float tolerance', () => {
        // 0.1 + 0.2 + 0.7 = 1.0000000000000002 in IEEE 754
        const rule = { ...DEFAULT_RULE, agent_share: 0.1, franchise_share: 0.2, hq_share: 0.7 };
        expect(validateCommissionRule(rule)).toHaveLength(0);
    });

    it('errors when shares sum to less than 1', () => {
        const rule = { ...DEFAULT_RULE, agent_share: 0.20 }; // 0.20+0.50+0.20 = 0.90
        const errors = validateCommissionRule(rule);
        expect(errors.some(e => e.field === 'shares')).toBe(true);
    });

    it('errors when shares sum to more than 1', () => {
        const rule = { ...DEFAULT_RULE, agent_share: 0.60 }; // 0.60+0.50+0.20 = 1.30
        const errors = validateCommissionRule(rule);
        expect(errors.some(e => e.field === 'shares')).toBe(true);
    });

    it('errors when commission_rate is 0', () => {
        const errors = validateCommissionRule({ ...DEFAULT_RULE, commission_rate: 0 });
        expect(errors.some(e => e.field === 'commission_rate')).toBe(true);
    });

    it('errors when commission_rate exceeds 1', () => {
        const errors = validateCommissionRule({ ...DEFAULT_RULE, commission_rate: 1.01 });
        expect(errors.some(e => e.field === 'commission_rate')).toBe(true);
    });

    it('errors when commission_rate is negative', () => {
        const errors = validateCommissionRule({ ...DEFAULT_RULE, commission_rate: -0.1 });
        expect(errors.some(e => e.field === 'commission_rate')).toBe(true);
    });

    it('errors when a share is negative', () => {
        const errors = validateCommissionRule({ ...DEFAULT_RULE, agent_share: -0.1, franchise_share: 0.9, hq_share: 0.2 });
        expect(errors.some(e => e.field === 'agent_share')).toBe(true);
    });

    it('errors when commission_rate is missing', () => {
        const { commission_rate: _, ...partial } = DEFAULT_RULE;
        const errors = validateCommissionRule(partial);
        expect(errors.some(e => e.field === 'commission_rate')).toBe(true);
    });

    it('errors when points_per_win is negative', () => {
        const errors = validateCommissionRule({ ...DEFAULT_RULE, points_per_win: -1 });
        expect(errors.some(e => e.field === 'points_per_win')).toBe(true);
    });

    it('returns multiple errors for multiple violations', () => {
        const errors = validateCommissionRule({ commission_rate: 0, agent_share: -1, franchise_share: 2, hq_share: 1 });
        expect(errors.length).toBeGreaterThan(1);
    });
});

// ---------------------------------------------------------------------------
// applyFranchiseOverride
// ---------------------------------------------------------------------------

describe('applyFranchiseOverride', () => {
    it('returns the original rule when royaltyPercent is null', () => {
        const result = applyFranchiseOverride(DEFAULT_RULE, null);
        expect(result).toBe(DEFAULT_RULE); // same reference — no copy made
    });

    it('returns the original rule when royaltyPercent is undefined', () => {
        const result = applyFranchiseOverride(DEFAULT_RULE, undefined);
        expect(result).toBe(DEFAULT_RULE);
    });

    it('redistributes agent share to franchise when royaltyPercent is 20%', () => {
        // agent_share = 0.30, 20% royalty on agent = 0.30 × 0.20 = 0.06
        // new agent_share    = 0.30 - 0.06 = 0.24
        // new franchise_share = 0.50 + 0.06 = 0.56
        const result = applyFranchiseOverride(DEFAULT_RULE, 20);
        expect(result.agent_share).toBeCloseTo(0.24, 4);
        expect(result.franchise_share).toBeCloseTo(0.56, 4);
        expect(result.hq_share).toBe(DEFAULT_RULE.hq_share); // unchanged
    });

    it('total shares still sum to 1 after override', () => {
        const result = applyFranchiseOverride(DEFAULT_RULE, 35);
        const total = result.agent_share + result.franchise_share + result.hq_share;
        expect(Math.abs(total - 1)).toBeLessThanOrEqual(0.0001);
    });

    it('100% royalty means agent keeps nothing, all goes to franchise', () => {
        const result = applyFranchiseOverride(DEFAULT_RULE, 100);
        expect(result.agent_share).toBeCloseTo(0, 4);
        expect(result.franchise_share).toBeCloseTo(
            DEFAULT_RULE.franchise_share + DEFAULT_RULE.agent_share,
            4,
        );
    });

    it('0% royalty leaves shares unchanged', () => {
        const result = applyFranchiseOverride(DEFAULT_RULE, 0);
        expect(result.agent_share).toBe(DEFAULT_RULE.agent_share);
        expect(result.franchise_share).toBe(DEFAULT_RULE.franchise_share);
    });

    it('throws when royaltyPercent is out of range', () => {
        expect(() => applyFranchiseOverride(DEFAULT_RULE, 101)).toThrow(/royaltyPercent/);
        expect(() => applyFranchiseOverride(DEFAULT_RULE, -1)).toThrow(/royaltyPercent/);
    });

    it('override + calculateCommissionSplit gives correct end amounts', () => {
        const overridden = applyFranchiseOverride(DEFAULT_RULE, 20);
        const split = calculateCommissionSplit(1000, overridden);
        // pot = 1000 × 0.15 = 150
        // agent = 150 × 0.24 = 36
        // franchise = 150 × 0.56 = 84
        // hq = 150 × 0.20 = 30
        expect(split.pot).toBe(150);
        expect(split.agent_commission).toBeCloseTo(36, 1);
        expect(split.franchise_profit).toBeCloseTo(84, 1);
        expect(split.hq_royalty).toBe(30);
    });
});
