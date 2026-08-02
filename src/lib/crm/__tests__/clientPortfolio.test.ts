import { describe, expect, it } from 'vitest';
import {
    buildClientPortfolio,
    buildClientRelationshipRecord,
    type ClientPortfolioSource,
    type ClientRelationshipSource,
} from '../clientPortfolio';

const clientA = '00000000-0000-4000-8000-000000000001';
const clientB = '00000000-0000-4000-8000-000000000002';
const supplyA1 = '00000000-0000-4000-8000-000000000011';
const supplyA2 = '00000000-0000-4000-8000-000000000012';
const supplyB = '00000000-0000-4000-8000-000000000013';
const ownerId = '00000000-0000-4000-8000-000000000021';
const openOpportunityId = '00000000-0000-4000-8000-000000000031';
const wonOpportunityId = '00000000-0000-4000-8000-000000000032';

const source: ClientPortfolioSource = {
    clients: [{
        id: clientA,
        name: 'Cliente Norte',
        email: 'norte@example.com',
        phone: '600000000',
        status: 'won',
        owner_id: ownerId,
        last_contact_date: '2026-07-20',
        created_at: '2026-01-01T10:00:00.000Z',
    }],
    owners: [{ id: ownerId, full_name: 'Ana Comercial' }],
    supplyPoints: [
        {
            id: supplyA1,
            client_id: clientA,
            supply_type: 'electricity',
            cups_last4: 'AA1F',
            address: 'Calle Norte 1',
            city: 'Madrid',
            current_marketer: 'Compañía A',
            current_tariff: '2.0TD',
        },
        {
            id: supplyA2,
            client_id: clientA,
            supply_type: 'gas',
            cups_last4: 'BB2G',
            address: 'Calle Norte 2',
            city: 'Madrid',
            current_marketer: 'Compañía B',
            current_tariff: 'RL.2',
        },
        {
            id: supplyB,
            client_id: clientB,
            supply_type: 'electricity',
            cups_last4: 'CC3H',
            address: null,
            city: null,
            current_marketer: null,
            current_tariff: null,
        },
    ],
    opportunities: [
        {
            id: openOpportunityId,
            client_id: clientA,
            supply_point_id: supplyA2,
            type: 'renewal',
            stage: 'proposal_preparation',
            stage_entered_at: '2026-07-25T10:00:00.000Z',
            next_action_title: 'Comparar tarifas',
            next_action_due_at: '2026-08-01T10:00:00.000Z',
            closed_at: null,
            created_at: '2026-07-25T10:00:00.000Z',
        },
        {
            id: wonOpportunityId,
            client_id: clientA,
            supply_point_id: supplyA1,
            type: 'switch',
            stage: 'won',
            stage_entered_at: '2026-05-01T10:00:00.000Z',
            next_action_title: null,
            next_action_due_at: null,
            closed_at: '2026-05-01T10:00:00.000Z',
            created_at: '2026-04-01T10:00:00.000Z',
        },
        {
            id: '00000000-0000-4000-8000-000000000099',
            client_id: clientA,
            supply_point_id: supplyB,
            type: 'switch',
            stage: 'data_review',
            stage_entered_at: '2026-07-30T10:00:00.000Z',
            next_action_title: 'No debe aparecer',
            next_action_due_at: '2026-07-31T10:00:00.000Z',
            closed_at: null,
            created_at: '2026-07-30T10:00:00.000Z',
        },
    ],
    contracts: [{
        id: '00000000-0000-4000-8000-000000000041',
        client_id: clientA,
        supply_point_id: supplyA1,
        opportunity_id: wonOpportunityId,
        status: 'active',
        marketer_name: 'Nueva Compañía',
        tariff_name: 'Plan Ahorro',
        start_date: '2026-05-01',
        end_date: '2027-05-01',
        permanence_status: 'known',
        created_at: '2026-05-01T10:00:00.000Z',
    }],
};

describe('client portfolio model', () => {
    it('summarizes the relationship without mixing historical and open deals', () => {
        const [item] = buildClientPortfolio(source);

        expect(item.supplyPointCount).toBe(2);
        expect(item.activeSupplyCount).toBe(1);
        expect(item.openOpportunityCount).toBe(1);
        expect(item.nextAction).toEqual({
            opportunityId: openOpportunityId,
            title: 'Comparar tarifas',
            dueAt: '2026-08-01T10:00:00.000Z',
            stage: 'proposal_preparation',
        });
        expect(item.currentContract?.marketer).toBe('Nueva Compañía');
        expect(item.nearestPermanenceDate).toBe('2027-05-01');
    });

    it('drops an opportunity whose supply belongs to another client', () => {
        const [item] = buildClientPortfolio(source);

        expect(item.openOpportunityCount).toBe(1);
        expect(item.nextAction?.title).not.toBe('No debe aparecer');
    });
});

describe('client relationship record', () => {
    const relationshipSource: ClientRelationshipSource = {
        ...source,
        documents: [
            {
                id: '00000000-0000-4000-8000-000000000051',
                client_id: clientA,
                supply_point_id: supplyA2,
                opportunity_id: openOpportunityId,
                file_name: 'factura-renovacion.pdf',
                status: 'completed',
                created_at: '2026-07-25T10:00:00.000Z',
            },
            {
                id: '00000000-0000-4000-8000-000000000052',
                client_id: clientA,
                supply_point_id: supplyA1,
                opportunity_id: wonOpportunityId,
                file_name: 'factura-anterior.pdf',
                status: 'completed',
                created_at: '2026-04-01T10:00:00.000Z',
            },
        ],
        activities: [{
            id: '00000000-0000-4000-8000-000000000061',
            client_id: clientA,
            type: 'note',
            description: 'Prefiere contacto por la mañana.',
            created_at: '2026-07-20T10:00:00.000Z',
        }],
    };

    it('preserves multiple supplies and successive opportunities as separate records', () => {
        const record = buildClientRelationshipRecord(clientA, relationshipSource);

        expect(record.supplyPoints).toHaveLength(2);
        expect(record.openOpportunities.map(item => item.id)).toEqual([openOpportunityId]);
        expect(record.history.map(item => item.id)).toEqual([wonOpportunityId]);
        expect(record.documents.map(item => item.opportunityId)).toEqual([
            openOpportunityId,
            wonOpportunityId,
        ]);
    });
});
