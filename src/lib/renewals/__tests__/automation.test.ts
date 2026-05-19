import { describe, expect, it } from 'vitest';
import { buildRenewalAutomationPlan } from '../automation';

describe('renewal automation plan', () => {
    it('creates a task, notification and push payload for a new renewal', () => {
        const plan = buildRenewalAutomationPlan({
            clientId: 'client-1',
            clientName: 'Restaurante Norte',
            proposalId: 'proposal-1',
            agentId: 'agent-1',
            franchiseId: 'franchise-1',
            marketer: 'Plenitude',
            tariffName: 'POWER PLUS',
            annualSavings: 812.4,
            savingsPercent: 12.34,
        }, new Date('2026-05-06T08:00:00.000Z'));

        expect(plan.shouldCreateTask).toBe(true);
        expect(plan.task).toMatchObject({
            client_id: 'client-1',
            proposal_id: 'proposal-1',
            agent_id: 'agent-1',
            priority: 'high',
            type: 'follow_up',
            status: 'pending',
            auto_generated: true,
        });
        expect(plan.task?.description).toContain('Plenitude · POWER PLUS');
        expect(plan.task?.description).toContain('812 €/año');
        expect(plan.notification.link).toBe('/dashboard/clients/client-1?tab=renewal');
        expect(plan.push.body).toContain('812 €/año');
    });

    it('does not create duplicate tasks when an open task already exists', () => {
        const plan = buildRenewalAutomationPlan({
            clientId: 'client-1',
            proposalId: 'proposal-1',
            agentId: 'agent-1',
            annualSavings: 151,
            savingsPercent: 4.2,
            existingTaskId: 'task-1',
        });

        expect(plan.shouldCreateTask).toBe(false);
        expect(plan.task).toBeNull();
        expect(plan.notification.message).toContain('151 €/año');
    });
});
