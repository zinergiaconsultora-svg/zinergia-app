import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OpportunityWorkspace } from '@/lib/crm/opportunityWorkspace';
import OpportunityWorkspaceView from '../OpportunityWorkspaceView';

const workspace: OpportunityWorkspace = {
    id: '00000000-0000-4000-8000-000000000001',
    type: 'switch',
    stage: 'data_review',
    stageEnteredAt: '2026-07-30T10:00:00.000Z',
    lossReason: null,
    nextAction: {
        type: 'review_invoice',
        title: 'Revisar factura',
        dueAt: '2026-08-01T10:00:00.000Z',
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
        label: 'Electricidad · AA1F',
        supplyType: 'electricity',
        address: 'Calle Principal 1, Madrid',
        currentMarketer: 'Compañía actual',
        currentTariff: '2.0TD',
        annualConsumptionKwh: 4200,
    },
    owner: {
        id: '00000000-0000-4000-8000-000000000004',
        name: 'Ana Comercial',
    },
    documents: [{
        id: '00000000-0000-4000-8000-000000000010',
        name: 'factura-julio.pdf',
        status: 'completed',
        createdAt: '2026-07-30T09:00:00.000Z',
        confirmedAt: null,
        errorMessage: null,
    }],
    proposals: [],
    contracts: [],
    commissions: [],
    tasks: [],
    activity: [{
        id: '00000000-0000-4000-8000-000000000011',
        kind: 'stage',
        title: 'Factura recibida → Revisar datos',
        detail: 'OCR completado',
        createdAt: '2026-07-30T10:00:00.000Z',
    }],
};

describe('OpportunityWorkspaceView', () => {
    it('shows one primary action and links to the long-lived client', () => {
        render(<OpportunityWorkspaceView workspace={workspace} role="agent" />);

        expect(screen.getAllByRole('link', { name: 'Revisar factura' })).toHaveLength(1);
        expect(screen.getByRole('link', { name: 'Ver cliente' }).getAttribute('href'))
            .toBe('/dashboard/clients/00000000-0000-4000-8000-000000000002');
    });

    it('keeps empty secondary sections compact and explicit', () => {
        render(<OpportunityWorkspaceView workspace={workspace} role="agent" />);

        expect(screen.getByText('Todavía no hay propuestas')).toBeTruthy();
        expect(screen.getByText('La parte económica aparecerá cuando exista una comisión.')).toBeTruthy();
        expect(screen.queryByText('0 propuestas')).toBeNull();
    });

    it('does not expose administrative exceptional actions to an agent', () => {
        render(<OpportunityWorkspaceView workspace={workspace} role="agent" />);

        expect(screen.queryByLabelText('Más acciones')).toBeNull();
    });

    it('keeps administrative actions secondary to the canonical next action', () => {
        render(<OpportunityWorkspaceView workspace={workspace} role="admin" />);

        expect(screen.getByLabelText('Más acciones')).toBeTruthy();
        expect(screen.getAllByRole('link', { name: 'Revisar factura' })).toHaveLength(1);
    });
});
