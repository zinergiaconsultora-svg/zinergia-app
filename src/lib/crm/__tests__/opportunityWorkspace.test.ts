import { describe, expect, it } from 'vitest';
import {
    buildOpportunityWorkspace,
    getOpportunityWorkspacePrimaryAction,
    type OpportunityWorkspaceSource,
} from '../opportunityWorkspace';

const source: OpportunityWorkspaceSource = {
    opportunity: {
        id: '00000000-0000-4000-8000-000000000001',
        client_id: '00000000-0000-4000-8000-000000000002',
        supply_point_id: '00000000-0000-4000-8000-000000000003',
        owner_id: '00000000-0000-4000-8000-000000000004',
        type: 'switch',
        stage: 'data_review',
        stage_entered_at: '2026-07-30T10:00:00.000Z',
        next_action_type: 'review_invoice',
        next_action_title: 'Revisar factura',
        next_action_due_at: '2026-08-01T10:00:00.000Z',
        loss_reason: null,
    },
    client: {
        id: '00000000-0000-4000-8000-000000000002',
        name: 'Cliente Norte',
        email: 'cliente@example.com',
        phone: '600000000',
        status: 'in_process',
    },
    supplyPoint: {
        id: '00000000-0000-4000-8000-000000000003',
        client_id: '00000000-0000-4000-8000-000000000002',
        supply_type: 'electricity',
        cups_last4: 'AA1F',
        address: 'Calle Principal 1',
        city: 'Madrid',
        current_marketer: 'Compañía actual',
        current_tariff: '2.0TD',
        annual_consumption_kwh: 4200,
    },
    owner: {
        id: '00000000-0000-4000-8000-000000000004',
        full_name: 'Ana Comercial',
    },
    documents: [{
        id: '00000000-0000-4000-8000-000000000010',
        opportunity_id: '00000000-0000-4000-8000-000000000001',
        file_name: 'factura-julio.pdf',
        status: 'completed',
        created_at: '2026-07-30T09:00:00.000Z',
        confirmed_at: null,
        error_message: null,
    }],
    proposals: [],
    contracts: [],
    commissions: [],
    tasks: [],
    history: [{
        id: '00000000-0000-4000-8000-000000000011',
        opportunity_id: '00000000-0000-4000-8000-000000000001',
        from_stage: 'invoice_received',
        to_stage: 'data_review',
        reason_code: 'ocr_completed',
        created_at: '2026-07-30T10:00:00.000Z',
    }],
};

describe('opportunity workspace model', () => {
    it('builds one focused workspace from records belonging to the same opportunity', () => {
        const workspace = buildOpportunityWorkspace(source);

        expect(workspace.client.name).toBe('Cliente Norte');
        expect(workspace.supplyPoint.label).toBe('Electricidad · AA1F');
        expect(workspace.documents).toHaveLength(1);
        expect(workspace.activity).toHaveLength(1);
    });

    it('rejects a supply point from another client', () => {
        expect(() => buildOpportunityWorkspace({
            ...source,
            supplyPoint: {
                ...source.supplyPoint,
                client_id: '00000000-0000-4000-8000-000000000099',
            },
        })).toThrow('Opportunity workspace boundary mismatch');
    });

    it('drops related rows from another opportunity instead of mixing cycles', () => {
        const workspace = buildOpportunityWorkspace({
            ...source,
            documents: [
                ...source.documents,
                {
                    ...source.documents[0],
                    id: '00000000-0000-4000-8000-000000000012',
                    opportunity_id: '00000000-0000-4000-8000-000000000098',
                },
            ],
        });

        expect(workspace.documents.map(document => document.id)).toEqual([
            '00000000-0000-4000-8000-000000000010',
        ]);
    });

    it('maps each active stage to one contextual primary action', () => {
        const workspace = buildOpportunityWorkspace(source);

        expect(getOpportunityWorkspacePrimaryAction(workspace)).toEqual({
            label: 'Revisar factura',
            href: '/dashboard/simulator?opportunity=00000000-0000-4000-8000-000000000001&client=00000000-0000-4000-8000-000000000002',
        });

        expect(getOpportunityWorkspacePrimaryAction({
            ...workspace,
            stage: 'proposal_sent',
            nextAction: { type: 'follow_up_proposal', title: 'Registrar seguimiento', dueAt: null },
        })).toEqual({ label: 'Registrar seguimiento', href: '#actividad' });

        expect(getOpportunityWorkspacePrimaryAction({
            ...workspace,
            stage: 'won',
            nextAction: null,
        })).toBeNull();
    });
});
