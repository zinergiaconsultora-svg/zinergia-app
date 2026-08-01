export type CommissionChannel = 'partner_direct' | 'franchise_network';

export type CommissionLifecycleStatus =
    | 'pending'
    | 'eligible'
    | 'validated'
    | 'invoiced'
    | 'paid'
    | 'reverted';

export interface CommissionPlanInput {
    readonly channel: CommissionChannel;
    readonly commercialShareBps: number;
    readonly franchiseShareBps: number;
    readonly centralShareBps: number;
}

export interface CommissionAllocation {
    readonly grossAmount: number;
    readonly commercialAmount: number;
    readonly franchiseAmount: number;
    readonly centralAmount: number;
}

export interface CommissionReversal extends CommissionAllocation {
    readonly reversalBps: number;
}

export interface DecommissionBandInput {
    readonly activeDayFrom: number;
    readonly activeDayTo: number;
    readonly reversalBps: number;
}

export interface DecommissionPolicyInput {
    readonly consolidationDays: number;
    readonly clawbackDays: number;
    readonly bands: readonly DecommissionBandInput[];
}

const BASIS_POINTS = 10_000;

const ALLOWED_TRANSITIONS: Readonly<Record<CommissionLifecycleStatus, readonly CommissionLifecycleStatus[]>> = {
    pending: ['eligible', 'reverted'],
    eligible: ['validated', 'reverted'],
    validated: ['invoiced', 'reverted'],
    invoiced: ['paid', 'reverted'],
    paid: ['reverted'],
    reverted: [],
};

export function validateCommissionPlan(plan: CommissionPlanInput): string[] {
    const errors: string[] = [];
    const shares = [plan.commercialShareBps, plan.franchiseShareBps, plan.centralShareBps];

    if (shares.some((share) => !Number.isInteger(share) || share < 0 || share > BASIS_POINTS)) {
        errors.push('All shares must be integer basis points between 0 and 10000.');
    }

    if (shares.reduce((total, share) => total + share, 0) !== BASIS_POINTS) {
        errors.push('Commercial, franchise and central shares must total 10000 basis points.');
    }

    if (plan.channel === 'partner_direct' && plan.franchiseShareBps !== 0) {
        errors.push('A direct-partner plan cannot allocate commission to a franchise.');
    }

    return errors;
}

export function validateDecommissionPolicy(policy: DecommissionPolicyInput): string[] {
    const errors: string[] = [];

    if (
        !Number.isInteger(policy.consolidationDays)
        || !Number.isInteger(policy.clawbackDays)
        || policy.consolidationDays < 0
        || policy.clawbackDays < policy.consolidationDays
        || policy.clawbackDays > 3_650
    ) {
        errors.push('The policy window is invalid.');
    }

    if (policy.bands.length < 1 || policy.bands.length > 12) {
        errors.push('A policy requires between 1 and 12 bands.');
        return errors;
    }

    let expectedFrom = 0;
    let previousReversalBps = BASIS_POINTS + 1;
    for (const band of policy.bands) {
        if (
            !Number.isInteger(band.activeDayFrom)
            || !Number.isInteger(band.activeDayTo)
            || !Number.isInteger(band.reversalBps)
            || band.activeDayFrom !== expectedFrom
            || band.activeDayTo < band.activeDayFrom
            || band.activeDayTo > policy.clawbackDays
        ) {
            errors.push('Policy bands must be continuous and cover valid active-day ranges.');
            break;
        }
        if (band.reversalBps < 0 || band.reversalBps > BASIS_POINTS) {
            errors.push('Band reversal must be between 0 and 10000 basis points.');
        }
        if (band.reversalBps > previousReversalBps) {
            errors.push('Band reversal cannot increase as active days advance.');
        }

        expectedFrom = band.activeDayTo + 1;
        previousReversalBps = band.reversalBps;
    }

    if (expectedFrom !== policy.clawbackDays + 1) {
        errors.push('Policy bands must cover the full clawback window.');
    }

    return [...new Set(errors)];
}

export function allocateGrossCommission(
    grossAmount: number,
    plan: CommissionPlanInput,
): CommissionAllocation {
    if (!Number.isFinite(grossAmount) || grossAmount < 0) {
        throw new RangeError('grossAmount must be a finite non-negative amount.');
    }

    const errors = validateCommissionPlan(plan);
    if (errors.length > 0) {
        throw new Error(`Invalid commission plan: ${errors.join(' ')}`);
    }

    const grossCents = toCents(grossAmount);
    const commercialCents = proportionalCents(grossCents, plan.commercialShareBps);
    const franchiseCents = proportionalCents(grossCents, plan.franchiseShareBps);
    const centralCents = grossCents - commercialCents - franchiseCents;

    return {
        grossAmount: fromCents(grossCents),
        commercialAmount: fromCents(commercialCents),
        franchiseAmount: fromCents(franchiseCents),
        centralAmount: fromCents(centralCents),
    };
}

export function calculateCommissionReversal(
    original: CommissionAllocation,
    reversalBps: number,
): CommissionReversal {
    if (!Number.isInteger(reversalBps) || reversalBps < 0 || reversalBps > BASIS_POINTS) {
        throw new RangeError('reversalBps must be an integer between 0 and 10000.');
    }

    const originalCents = {
        gross: toCents(original.grossAmount),
        commercial: toCents(original.commercialAmount),
        franchise: toCents(original.franchiseAmount),
        central: toCents(original.centralAmount),
    };

    if (originalCents.commercial + originalCents.franchise + originalCents.central !== originalCents.gross) {
        throw new Error('Original commission allocation is not balanced.');
    }

    const grossCents = proportionalCents(originalCents.gross, reversalBps);
    const commercialCents = proportionalCents(originalCents.commercial, reversalBps);
    const franchiseCents = proportionalCents(originalCents.franchise, reversalBps);
    const centralCents = grossCents - commercialCents - franchiseCents;

    return {
        reversalBps,
        grossAmount: fromCents(grossCents),
        commercialAmount: fromCents(commercialCents),
        franchiseAmount: fromCents(franchiseCents),
        centralAmount: fromCents(centralCents),
    };
}

export function canTransitionCommission(
    from: CommissionLifecycleStatus,
    to: CommissionLifecycleStatus,
): boolean {
    return ALLOWED_TRANSITIONS[from].includes(to);
}

export function statusAfterReversal(
    current: CommissionLifecycleStatus,
    totalReversedBps: number,
): CommissionLifecycleStatus {
    if (!Number.isInteger(totalReversedBps) || totalReversedBps < 0 || totalReversedBps > BASIS_POINTS) {
        throw new RangeError('totalReversedBps must be an integer between 0 and 10000.');
    }

    return totalReversedBps === BASIS_POINTS ? 'reverted' : current;
}

function proportionalCents(amountCents: number, shareBps: number): number {
    return Math.round((amountCents * shareBps) / BASIS_POINTS);
}

function toCents(amount: number): number {
    return Math.round(amount * 100);
}

function fromCents(cents: number): number {
    return cents / 100;
}
