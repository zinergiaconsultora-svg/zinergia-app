export const OPPORTUNITY_TYPES = ['new_business', 'switch', 'renewal'] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_STAGES = [
    'invoice_received',
    'data_review',
    'proposal_preparation',
    'proposal_sent',
    'accepted',
    'activation',
    'won',
    'lost',
] as const;
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export type OpportunityNextActionType =
    | 'wait_for_ocr'
    | 'review_invoice'
    | 'compare_tariffs'
    | 'follow_up_proposal'
    | 'complete_activation'
    | 'resolve_activation';

export interface OpportunityNextAction {
    type: OpportunityNextActionType;
    title: string;
}

export interface OpportunityStageHistoryEntry {
    fromStage: OpportunityStage | null;
    toStage: OpportunityStage;
    createdAt: string;
}

export type OpportunityDueGroup = 'overdue' | 'today' | 'upcoming' | 'no_date';
export type OpportunityRole = 'admin' | 'franchise' | 'agent';
export type OpportunityCommand =
    | 'transition'
    | 'record_follow_up'
    | 'mark_lost'
    | 'reopen'
    | 'confirm_activation'
    | 'reassign'
    | 'validate_commission';

const ALLOWED_TRANSITIONS: Readonly<Record<OpportunityStage, readonly OpportunityStage[]>> = {
    invoice_received: ['data_review', 'lost'],
    data_review: ['proposal_preparation', 'lost'],
    proposal_preparation: ['proposal_sent', 'lost'],
    proposal_sent: ['accepted', 'lost'],
    accepted: ['activation', 'lost'],
    activation: ['won', 'lost'],
    won: [],
    lost: [],
};

const NEXT_ACTIONS: Readonly<Partial<Record<OpportunityStage, OpportunityNextAction>>> = {
    invoice_received: { type: 'wait_for_ocr', title: 'Ver estado del OCR' },
    data_review: { type: 'review_invoice', title: 'Revisar factura' },
    proposal_preparation: { type: 'compare_tariffs', title: 'Comparar tarifas' },
    proposal_sent: { type: 'follow_up_proposal', title: 'Registrar seguimiento' },
    accepted: { type: 'complete_activation', title: 'Completar alta' },
    activation: { type: 'resolve_activation', title: 'Resolver requisitos de alta' },
};

const ADMIN_ONLY_COMMANDS = new Set<OpportunityCommand>([
    'confirm_activation',
    'reassign',
    'reopen',
    'validate_commission',
]);

export function isTerminalOpportunityStage(stage: OpportunityStage): boolean {
    return stage === 'won' || stage === 'lost';
}

export function canTransitionOpportunity(
    fromStage: OpportunityStage,
    toStage: OpportunityStage,
): boolean {
    return ALLOWED_TRANSITIONS[fromStage].includes(toStage);
}

export function getOpportunityNextAction(
    stage: OpportunityStage,
): OpportunityNextAction | null {
    return NEXT_ACTIONS[stage] ?? null;
}

export function getOpportunityStageAgeDays(
    stageEnteredAt: string,
    now: string | Date = new Date(),
): number {
    const entered = new Date(stageEnteredAt).getTime();
    const current = new Date(now).getTime();

    if (!Number.isFinite(entered) || !Number.isFinite(current)) {
        throw new Error('Invalid opportunity stage date');
    }

    return Math.max(0, Math.floor((current - entered) / 86_400_000));
}

export function getOpportunityDueGroup(
    dueAt: string | null,
    now: string | Date = new Date(),
): OpportunityDueGroup {
    if (!dueAt) return 'no_date';

    const due = new Date(dueAt);
    const current = new Date(now);

    if (!Number.isFinite(due.getTime()) || !Number.isFinite(current.getTime())) {
        throw new Error('Invalid opportunity due date');
    }

    const dueDay = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
    const currentDay = Date.UTC(
        current.getUTCFullYear(),
        current.getUTCMonth(),
        current.getUTCDate(),
    );

    if (dueDay < currentDay) return 'overdue';
    if (dueDay === currentDay) return 'today';
    return 'upcoming';
}

export function getOpportunityReopenStage(
    history: readonly OpportunityStageHistoryEntry[],
): OpportunityStage {
    const lossEvent = [...history]
        .reverse()
        .find(entry => entry.toStage === 'lost' && entry.fromStage !== null);

    if (!lossEvent?.fromStage || isTerminalOpportunityStage(lossEvent.fromStage)) {
        throw new Error('Opportunity has no valid stage to reopen');
    }

    return lossEvent.fromStage;
}

export function canRunOpportunityCommand(
    role: OpportunityRole,
    command: OpportunityCommand,
): boolean {
    if (ADMIN_ONLY_COMMANDS.has(command)) return role === 'admin';
    return role === 'admin' || role === 'franchise' || role === 'agent';
}
