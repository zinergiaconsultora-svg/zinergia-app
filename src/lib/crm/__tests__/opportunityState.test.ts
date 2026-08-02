import { describe, expect, it } from 'vitest';
import {
    canRunOpportunityCommand,
    canTransitionOpportunity,
    getOpportunityDueGroup,
    getOpportunityNextAction,
    getOpportunityReopenStage,
    getOpportunityStageAgeDays,
    isTerminalOpportunityStage,
    type OpportunityStage,
} from '../opportunityState';

const ORDERED_STAGES: OpportunityStage[] = [
    'invoice_received',
    'data_review',
    'proposal_preparation',
    'proposal_sent',
    'accepted',
    'activation',
    'won',
];

describe('opportunity state transitions', () => {
    it('allows the complete professional happy path', () => {
        for (let index = 0; index < ORDERED_STAGES.length - 1; index += 1) {
            expect(
                canTransitionOpportunity(ORDERED_STAGES[index], ORDERED_STAGES[index + 1]),
            ).toBe(true);
        }
    });

    it('allows losing an open opportunity but keeps terminal states closed', () => {
        for (const stage of ORDERED_STAGES.slice(0, -1)) {
            expect(canTransitionOpportunity(stage, 'lost')).toBe(true);
        }

        expect(isTerminalOpportunityStage('won')).toBe(true);
        expect(isTerminalOpportunityStage('lost')).toBe(true);
        expect(canTransitionOpportunity('won', 'proposal_preparation')).toBe(false);
        expect(canTransitionOpportunity('lost', 'data_review')).toBe(false);
    });

    it('rejects skipped or backwards transitions', () => {
        expect(canTransitionOpportunity('invoice_received', 'proposal_sent')).toBe(false);
        expect(canTransitionOpportunity('proposal_sent', 'data_review')).toBe(false);
        expect(canTransitionOpportunity('activation', 'accepted')).toBe(false);
    });
});

describe('opportunity next action', () => {
    it.each([
        ['invoice_received', 'wait_for_ocr'],
        ['data_review', 'review_invoice'],
        ['proposal_preparation', 'compare_tariffs'],
        ['proposal_sent', 'follow_up_proposal'],
        ['accepted', 'complete_activation'],
        ['activation', 'resolve_activation'],
    ] as const)('maps %s to %s', (stage, actionType) => {
        expect(getOpportunityNextAction(stage)?.type).toBe(actionType);
    });

    it('does not assign work to terminal opportunities', () => {
        expect(getOpportunityNextAction('won')).toBeNull();
        expect(getOpportunityNextAction('lost')).toBeNull();
    });
});

describe('opportunity timing', () => {
    const now = '2026-07-30T12:00:00.000Z';

    it('calculates stage age without returning negative values', () => {
        expect(getOpportunityStageAgeDays('2026-07-27T12:00:00.000Z', now)).toBe(3);
        expect(getOpportunityStageAgeDays('2026-08-01T12:00:00.000Z', now)).toBe(0);
    });

    it('groups work by UTC business date', () => {
        expect(getOpportunityDueGroup('2026-07-29T23:59:59.000Z', now)).toBe('overdue');
        expect(getOpportunityDueGroup('2026-07-30T00:00:00.000Z', now)).toBe('today');
        expect(getOpportunityDueGroup('2026-07-31T00:00:00.000Z', now)).toBe('upcoming');
        expect(getOpportunityDueGroup(null, now)).toBe('no_date');
    });
});

describe('opportunity reopening and role controls', () => {
    it('reopens to the stage recorded before loss instead of re-deriving state', () => {
        expect(getOpportunityReopenStage([
            {
                fromStage: null,
                toStage: 'invoice_received',
                createdAt: '2026-07-01T10:00:00.000Z',
            },
            {
                fromStage: 'invoice_received',
                toStage: 'data_review',
                createdAt: '2026-07-01T11:00:00.000Z',
            },
            {
                fromStage: 'data_review',
                toStage: 'lost',
                createdAt: '2026-07-02T11:00:00.000Z',
            },
        ])).toBe('data_review');
    });

    it('rejects reopening without a valid prior open stage', () => {
        expect(() => getOpportunityReopenStage([])).toThrow(
            'Opportunity has no valid stage to reopen',
        );
    });

    it('keeps activation confirmation, reassignment and validation admin-only', () => {
        for (const command of [
            'confirm_activation',
            'reassign',
            'reopen',
            'validate_commission',
        ] as const) {
            expect(canRunOpportunityCommand('admin', command)).toBe(true);
            expect(canRunOpportunityCommand('franchise', command)).toBe(false);
            expect(canRunOpportunityCommand('agent', command)).toBe(false);
        }

        expect(canRunOpportunityCommand('agent', 'record_follow_up')).toBe(true);
        expect(canRunOpportunityCommand('franchise', 'transition')).toBe(true);
    });
});
