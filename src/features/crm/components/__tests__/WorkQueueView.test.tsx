import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type {
    OpportunityWorkGroup,
    OpportunityWorkItem,
} from '@/lib/crm/workQueue';
import WorkQueueView from '../WorkQueueView';

const overdueItem: OpportunityWorkItem = {
    opportunityId: '00000000-0000-4000-8000-000000000001',
    clientId: '00000000-0000-4000-8000-000000000002',
    supplyPointId: '00000000-0000-4000-8000-000000000003',
    ownerId: '00000000-0000-4000-8000-000000000004',
    ownerName: 'Ana Comercial',
    franchiseId: '00000000-0000-4000-8000-000000000005',
    type: 'switch',
    stage: 'data_review',
    clientName: 'Cliente Norte',
    supplyLabel: 'Electricidad · AA1F',
    stageEnteredAt: '2026-07-28T10:00:00.000Z',
    stageAgeDays: 3,
    nextAction: { type: 'review_invoice', title: 'Revisar factura' },
    nextActionDueAt: '2026-07-30T10:00:00.000Z',
    dueGroup: 'overdue',
};

const todayItem: OpportunityWorkItem = {
    ...overdueItem,
    opportunityId: '00000000-0000-4000-8000-000000000010',
    clientId: '00000000-0000-4000-8000-000000000011',
    supplyPointId: '00000000-0000-4000-8000-000000000012',
    clientName: 'Cliente Sur',
    supplyLabel: 'Gas · BB2G',
    stage: 'proposal_sent',
    nextAction: { type: 'follow_up_proposal', title: 'Registrar seguimiento' },
    nextActionDueAt: '2026-07-31T12:00:00.000Z',
    dueGroup: 'today',
};

const groups: OpportunityWorkGroup[] = [
    { key: 'overdue', label: 'Vencido', items: [overdueItem] },
    { key: 'today', label: 'Hoy', items: [todayItem] },
    { key: 'upcoming', label: 'Próximos', items: [overdueItem] },
    { key: 'no_date', label: 'Sin fecha', items: [] },
];

describe('WorkQueueView', () => {
    it('keeps the empty state free of useless filters and duplicate page actions', () => {
        render(<WorkQueueView groups={[]} role="agent" />);

        expect(screen.queryByRole('searchbox')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Filtros' })).toBeNull();
        expect(screen.getAllByRole('link', { name: 'Subir factura' })).toHaveLength(1);
    });

    it('renders each opportunity in one row even if the input repeats it', () => {
        render(<WorkQueueView groups={groups} role="agent" />);

        expect(
            screen.getAllByRole('button', { name: /Cliente Norte/ }),
        ).toHaveLength(1);
        expect(screen.getByRole('button', { name: /Pendientes\s*2/ })).toBeTruthy();
        expect(screen.getAllByRole('link', { name: 'Revisar factura' })[0].getAttribute('href'))
            .toBe('/dashboard/opportunities/00000000-0000-4000-8000-000000000001');
    });

    it('uses the summaries as one simple urgency filter', () => {
        render(<WorkQueueView groups={groups} role="agent" />);

        fireEvent.click(screen.getByRole('button', { name: /Vencidos\s*1/ }));

        expect(screen.getAllByText('Cliente Norte').length).toBeGreaterThan(0);
        expect(screen.queryByText('Cliente Sur')).toBeNull();
    });

    it('searches the same queue instead of creating another result surface', () => {
        render(<WorkQueueView groups={groups} role="agent" />);

        fireEvent.change(screen.getByRole('searchbox', {
            name: 'Buscar cliente o suministro',
        }), {
            target: { value: 'BB2G' },
        });

        expect(screen.getAllByText('Cliente Sur').length).toBeGreaterThan(0);
        expect(screen.queryByText('Cliente Norte')).toBeNull();
    });

    it('shows the responsible-person filter only to portfolio managers', () => {
        const agentRender = render(<WorkQueueView groups={groups} role="agent" />);
        fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
        expect(screen.queryByLabelText('Responsable')).toBeNull();
        agentRender.unmount();

        render(<WorkQueueView groups={groups} role="franchise" />);
        fireEvent.click(screen.getByRole('button', { name: 'Filtros' }));
        expect(screen.getByLabelText('Responsable')).toBeTruthy();
        expect(screen.getByRole('option', { name: 'Ana Comercial' })).toBeTruthy();
    });
});
