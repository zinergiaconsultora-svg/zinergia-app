import { describe, expect, it } from 'vitest';
import { buildProposalFollowupPlan } from '../followup';

describe('buildProposalFollowupPlan', () => {
    it('differentiates unopened 3-day followups', () => {
        const plan = buildProposalFollowupPlan({
            stage: 3,
            clientName: 'Rocio Medina',
            annualSavings: 420,
            opened: false,
        });

        expect(plan.notification.type).toBe('followup_due');
        expect(plan.notification.message).toContain('no ha abierto');
        expect(plan.push.body).toContain('3 dias');
    });

    it('prioritizes calls when a 7-day proposal was opened but not signed', () => {
        const plan = buildProposalFollowupPlan({
            stage: 7,
            clientName: 'Andres Acero',
            annualSavings: 1800,
            opened: true,
        });

        expect(plan.notification.title).toContain('Respuesta urgente');
        expect(plan.notification.message).toContain('abri');
        expect(plan.push.body).toContain('Abierta sin firma');
    });
});
