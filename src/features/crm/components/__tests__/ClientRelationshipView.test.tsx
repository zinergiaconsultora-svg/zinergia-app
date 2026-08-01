import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClientRelationshipRecord } from '@/lib/crm/clientPortfolio';
import ClientRelationshipView from '../ClientRelationshipView';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/app/actions/clients', () => ({
    deleteClientAction: vi.fn(),
}));

const record: ClientRelationshipRecord = {
    client: {
        id: '00000000-0000-4000-8000-000000000001',
        name: 'Cliente Norte',
        email: 'norte@example.com',
        phone: '600000000',
        status: 'won',
        ownerId: '00000000-0000-4000-8000-000000000002',
        ownerName: 'Ana Comercial',
        lastContactAt: '2026-07-20',
    },
    supplyPoints: [
        { id: 'supply-1', label: 'Electricidad · AA1F', address: 'Calle 1', marketer: 'A', tariff: '2.0TD' },
        { id: 'supply-2', label: 'Gas · BB2G', address: 'Calle 2', marketer: 'B', tariff: 'RL.2' },
    ],
    openOpportunities: [{
        id: 'opportunity-open',
        supplyPointId: 'supply-2',
        supplyLabel: 'Gas · BB2G',
        type: 'renewal',
        stage: 'proposal_preparation',
        nextActionTitle: 'Comparar tarifas',
        nextActionDueAt: null,
        createdAt: '2026-07-20T10:00:00.000Z',
    }],
    history: [{
        id: 'opportunity-won',
        supplyPointId: 'supply-1',
        supplyLabel: 'Electricidad · AA1F',
        type: 'switch',
        stage: 'won',
        nextActionTitle: null,
        nextActionDueAt: null,
        createdAt: '2026-04-01T10:00:00.000Z',
    }],
    contracts: [],
    documents: [],
    activities: [],
};

describe('ClientRelationshipView', () => {
    it('separates current work from historical opportunities and supplies', () => {
        render(<ClientRelationshipView record={record} />);

        expect(screen.getByRole('heading', { name: 'Suministros' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Oportunidades abiertas' })).toBeTruthy();
        expect(screen.getByRole('heading', { name: 'Historial comercial' })).toBeTruthy();
        expect(screen.getByRole('link', { name: /Comparar tarifas/ }).getAttribute('href'))
            .toBe('/dashboard/opportunities/opportunity-open');
        expect(screen.getAllByText('Electricidad · AA1F').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Gas · BB2G').length).toBeGreaterThan(0);
    });
});
