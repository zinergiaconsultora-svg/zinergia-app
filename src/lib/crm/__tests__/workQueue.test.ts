import { describe, expect, it } from 'vitest';
import {
    groupOpportunityWorkItems,
    mapOpportunityWorkQueueRow,
    resolveWorkQueueScope,
} from '../workQueue';

const baseRow = {
    opportunity_id: '00000000-0000-4000-8000-000000000001',
    client_id: '00000000-0000-4000-8000-000000000002',
    supply_point_id: '00000000-0000-4000-8000-000000000003',
    owner_id: '00000000-0000-4000-8000-000000000004',
    owner_name: 'Comercial prueba',
    franchise_id: '00000000-0000-4000-8000-000000000005',
    type: 'switch',
    stage: 'proposal_sent',
    client_name: 'Cliente prueba',
    supply_label: 'Electricidad · 1234',
    stage_entered_at: '2026-07-28T10:00:00.000Z',
    stage_age_days: 3,
    next_action_type: 'follow_up_proposal',
    next_action_title: 'Registrar seguimiento',
    next_action_due_at: '2026-07-31T12:00:00.000Z',
    due_group: 'today',
};

describe('CRM opportunity work queue', () => {
    it('maps the database view to the stable domain contract', () => {
        expect(mapOpportunityWorkQueueRow(baseRow)).toEqual({
            opportunityId: baseRow.opportunity_id,
            clientId: baseRow.client_id,
            supplyPointId: baseRow.supply_point_id,
            ownerId: baseRow.owner_id,
            ownerName: 'Comercial prueba',
            franchiseId: baseRow.franchise_id,
            type: 'switch',
            stage: 'proposal_sent',
            clientName: 'Cliente prueba',
            supplyLabel: 'Electricidad · 1234',
            stageEnteredAt: baseRow.stage_entered_at,
            stageAgeDays: 3,
            nextAction: {
                type: 'follow_up_proposal',
                title: 'Registrar seguimiento',
            },
            nextActionDueAt: baseRow.next_action_due_at,
            dueGroup: 'today',
        });
    });

    it('rejects malformed rows instead of leaking an unstable contract', () => {
        expect(() => mapOpportunityWorkQueueRow({
            ...baseRow,
            stage: 'legacy_stage',
        })).toThrow('Invalid CRM work queue row');
    });

    it('groups items in operational priority order', () => {
        const items = [
            mapOpportunityWorkQueueRow({ ...baseRow, opportunity_id: 'no-date', due_group: 'no_date', next_action_due_at: null }),
            mapOpportunityWorkQueueRow({ ...baseRow, opportunity_id: 'upcoming', due_group: 'upcoming' }),
            mapOpportunityWorkQueueRow({ ...baseRow, opportunity_id: 'overdue', due_group: 'overdue' }),
            mapOpportunityWorkQueueRow({ ...baseRow, opportunity_id: 'today', due_group: 'today' }),
        ];

        const grouped = groupOpportunityWorkItems(items);

        expect(grouped.map(group => group.key)).toEqual([
            'overdue',
            'today',
            'upcoming',
            'no_date',
        ]);
        expect(grouped.map(group => group.label)).toEqual([
            'Vencido',
            'Hoy',
            'Próximos',
            'Sin fecha',
        ]);
    });

    it('shows each opportunity once and keeps its highest-priority occurrence', () => {
        const grouped = groupOpportunityWorkItems([
            mapOpportunityWorkQueueRow({
                ...baseRow,
                due_group: 'upcoming',
                next_action_due_at: '2026-08-04T12:00:00.000Z',
            }),
            mapOpportunityWorkQueueRow({
                ...baseRow,
                due_group: 'overdue',
                next_action_due_at: '2026-07-30T12:00:00.000Z',
            }),
        ]);

        expect(grouped.flatMap(group => group.items)).toHaveLength(1);
        expect(grouped[0].items[0].dueGroup).toBe('overdue');
    });

    it('forces agents to their own portfolio and permits scoped management filters', () => {
        expect(resolveWorkQueueScope(
            'agent',
            'agent-id',
            { ownerId: 'other-id' },
        )).toEqual({ ownerId: 'agent-id' });

        expect(resolveWorkQueueScope(
            'franchise',
            'franchise-user-id',
            { ownerId: 'agent-id' },
        )).toEqual({ ownerId: 'agent-id' });

        expect(resolveWorkQueueScope(
            'admin',
            'admin-id',
            {},
        )).toEqual({ ownerId: null });
    });
});
