import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AcceptanceIntegrityPanel from '../AcceptanceIntegrityPanel';

vi.mock('@/app/actions/acceptanceIntegrity', () => ({
    retryAcceptanceIntegrityAction: vi.fn(),
}));

const baseItem = {
    proposalId: '11111111-1111-4111-8111-111111111111',
    opportunityId: '22222222-2222-4222-8222-222222222222',
    ownerId: 'agent-1',
    acceptedAt: '2026-07-31T10:00:00Z',
    opportunityStage: 'accepted',
    missingOpportunity: false,
    missingActivation: true,
    missingCommission: true,
    missingContract: false,
    issueCount: 2,
};

describe('AcceptanceIntegrityPanel', () => {
    it('stays out of the admin workflow when there is nothing to reconcile', () => {
        const { container } = render(<AcceptanceIntegrityPanel initialItems={[]} />);
        expect(container.innerHTML).toBe('');
    });

    it('shows only operational identifiers and missing effects', () => {
        render(<AcceptanceIntegrityPanel initialItems={[baseItem]} />);

        expect(screen.getByText('Propuesta 11111111')).toBeTruthy();
        expect(screen.getByText('Pendiente: Alta, Comisión')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Reintentar' }).hasAttribute('disabled')).toBe(false);
    });

    it('requires manual review instead of guessing a legacy opportunity', () => {
        render(<AcceptanceIntegrityPanel initialItems={[{
            ...baseItem,
            opportunityId: null,
            missingOpportunity: true,
        }]} />);

        expect(screen.getByRole('button', { name: 'Revisión manual' }).hasAttribute('disabled')).toBe(true);
    });
});
