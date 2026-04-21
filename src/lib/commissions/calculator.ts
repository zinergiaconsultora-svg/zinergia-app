/**
 * Commission calculator — pure functions, no I/O.
 *
 * The split model works as follows:
 *
 *   pot              = annual_savings × commission_rate
 *   agent_commission = pot × agent_share
 *   franchise_profit = pot × franchise_share
 *   hq_royalty       = pot × hq_share
 *
 * agent_share + franchise_share + hq_share must equal 1.
 *
 * All monetary amounts are returned rounded to 2 decimal places (cents).
 * Points are returned as a whole integer.
 *
 * This module has no dependencies and can be freely imported in tests,
 * server actions, and client components alike.
 */

/** Subset of CommissionRule columns needed for calculation. */
export interface CommissionRuleInput {
    readonly commission_rate: number;  // fraction of annual savings (0 < x ≤ 1)
    readonly agent_share: number;      // fraction of pot → agent     (0–1)
    readonly franchise_share: number;  // fraction of pot → franchise (0–1)
    readonly hq_share: number;         // fraction of pot → HQ        (0–1)
    readonly points_per_win: number;   // gamification points awarded
}

/** Result of a commission split calculation. */
export interface CommissionSplit {
    /** Total revenue = annual_savings × commission_rate (before split). */
    readonly pot: number;
    /** Agent's cut of the pot. */
    readonly agent_commission: number;
    /** Franchise's cut of the pot. */
    readonly franchise_profit: number;
    /** HQ royalty cut of the pot. */
    readonly hq_royalty: number;
    /** Gamification points to award. */
    readonly points: number;
}

/** Validation error description. */
export interface ValidationError {
    readonly field: string;
    readonly message: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calculate the full commission split for a closed deal.
 *
 * @param annualSavings  Projected annual saving for the client (€). Must be ≥ 0.
 * @param rule           Active commission rule.
 * @returns              Commission split, all amounts rounded to cents.
 * @throws               If annualSavings is negative or rule shares don't sum to 1.
 */
export function calculateCommissionSplit(
    annualSavings: number,
    rule: CommissionRuleInput,
): CommissionSplit {
    if (annualSavings < 0) {
        throw new RangeError(`annualSavings must be ≥ 0, got ${annualSavings}`);
    }

    const errors = validateCommissionRule(rule);
    if (errors.length > 0) {
        throw new Error(`Invalid commission rule: ${errors.map(e => e.message).join('; ')}`);
    }

    const pot = round2(annualSavings * rule.commission_rate);
    return {
        pot,
        agent_commission: round2(pot * rule.agent_share),
        franchise_profit: round2(pot * rule.franchise_share),
        hq_royalty: round2(pot * rule.hq_share),
        points: Math.round(rule.points_per_win),
    };
}

/**
 * Validate a commission rule object.
 * Returns an array of validation errors (empty = valid).
 *
 * Useful for form validation before calling saveCommissionRule().
 */
export function validateCommissionRule(
    rule: Partial<CommissionRuleInput>,
): ValidationError[] {
    const errors: ValidationError[] = [];

    // commission_rate
    if (rule.commission_rate === undefined || rule.commission_rate === null) {
        errors.push({ field: 'commission_rate', message: 'commission_rate is required' });
    } else if (rule.commission_rate <= 0 || rule.commission_rate > 1) {
        errors.push({
            field: 'commission_rate',
            message: `commission_rate must be between 0 (exclusive) and 1 (inclusive), got ${rule.commission_rate}`,
        });
    }

    // shares
    const agentShare = rule.agent_share ?? NaN;
    const franchiseShare = rule.franchise_share ?? NaN;
    const hqShare = rule.hq_share ?? NaN;

    if (!isFinite(agentShare) || agentShare < 0 || agentShare > 1) {
        errors.push({ field: 'agent_share', message: `agent_share must be between 0 and 1, got ${rule.agent_share}` });
    }
    if (!isFinite(franchiseShare) || franchiseShare < 0 || franchiseShare > 1) {
        errors.push({ field: 'franchise_share', message: `franchise_share must be between 0 and 1, got ${rule.franchise_share}` });
    }
    if (!isFinite(hqShare) || hqShare < 0 || hqShare > 1) {
        errors.push({ field: 'hq_share', message: `hq_share must be between 0 and 1, got ${rule.hq_share}` });
    }

    // shares must sum to 1 (±0.001 tolerance for float representation)
    if (isFinite(agentShare) && isFinite(franchiseShare) && isFinite(hqShare)) {
        const total = agentShare + franchiseShare + hqShare;
        if (Math.abs(total - 1) > 0.001) {
            errors.push({
                field: 'shares',
                message: `agent_share + franchise_share + hq_share must equal 1.000 (got ${total.toFixed(4)})`,
            });
        }
    }

    // points_per_win
    if (rule.points_per_win !== undefined && rule.points_per_win < 0) {
        errors.push({ field: 'points_per_win', message: `points_per_win must be ≥ 0, got ${rule.points_per_win}` });
    }

    return errors;
}

/**
 * Returns the "effective" franchise share when per-franchise overrides apply.
 *
 * Per CLAUDE.md: Franchise earns a configurable % of the agent's commission
 * (not the HQ pot). This helper converts the royalty_percent (0–100) stored
 * in franchise_config into the split fractions used by calculateCommissionSplit.
 *
 * If royalty_percent is null/undefined, the base rule's franchise_share is used.
 */
export function applyFranchiseOverride(
    rule: CommissionRuleInput,
    royaltyPercent: number | null | undefined,
): CommissionRuleInput {
    if (royaltyPercent === null || royaltyPercent === undefined) return rule;
    if (royaltyPercent < 0 || royaltyPercent > 100) {
        throw new RangeError(`royaltyPercent must be 0–100, got ${royaltyPercent}`);
    }
    // royalty_percent is the franchise's cut of the agent's commission.
    // The remaining agent commission stays with the agent.
    // HQ share is unchanged.
    const franchiseExtra = rule.agent_share * (royaltyPercent / 100);
    return {
        ...rule,
        agent_share: round4(rule.agent_share - franchiseExtra),
        franchise_share: round4(rule.franchise_share + franchiseExtra),
    };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function round4(n: number): number {
    return Math.round(n * 10000) / 10000;
}
