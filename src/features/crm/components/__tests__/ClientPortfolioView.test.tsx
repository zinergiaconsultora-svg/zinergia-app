import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClientPortfolioItem } from '@/lib/crm/clientPortfolio';
import ClientPortfolioView from '../ClientPortfolioView';

vi.mock('next/navigation', () => ({
    useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const item: ClientPortfolioItem = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Cliente Norte',
    email: 'norte@example.com',
    phone: '600000000',
    status: 'won',
    ownerId: '00000000-0000-4000-8000-000000000002',
    ownerName: 'Ana Comercial',
    lastContactAt: '2026-07-20',
    supplyPointCount: 2,
    activeSupplyCount: 1,
    openOpportunityCount: 1,
    nextAction: {
        opportunityId: '00000000-0000-4000-8000-000000000003',
        title: 'Comparar tarifas',
        dueAt: '2026-08-01T10:00:00.000Z',
        stage: 'proposal_preparation',
    },
    currentContract: {
        marketer: 'Nueva Compañía',
        tariff: 'Plan Ahorro',
        supplyPointId: '00000000-0000-4000-8000-000000000004',
    },
    nearestPermanenceDate: '2027-05-01',
};

describe('ClientPortfolioView', () => {
    it('shows operational relationship fields without dashboard metrics', () => {
        render(<ClientPortfolioView items={[item]} role="agent" />);

        expect(screen.getByText('Cliente Norte')).toBeTruthy();
        expect(screen.getByText('2 suministros')).toBeTruthy();
        expect(screen.getByRole('link', { name: 'Comparar tarifas' }).getAttribute('href'))
            .toBe('/dashboard/opportunities/00000000-0000-4000-8000-000000000003');
        expect(screen.queryByText('Valor Pipeline')).toBeNull();
        expect(screen.queryByText('Tasa Conversión')).toBeNull();
    });

    it('searches the same portfolio surface', () => {
        render(<ClientPortfolioView items={[item]} role="agent" />);

        fireEvent.change(screen.getByRole('searchbox', { name: 'Buscar clientes' }), {
            target: { value: 'sur' },
        });

        expect(screen.queryByText('Cliente Norte')).toBeNull();
        expect(screen.getByText('No hay clientes que coincidan')).toBeTruthy();
    });

    it('does not render filters when the portfolio is empty', () => {
        render(<ClientPortfolioView items={[]} role="agent" />);

        expect(screen.queryByRole('searchbox')).toBeNull();
        expect(screen.getByText('Todavía no hay clientes')).toBeTruthy();
    });
});
