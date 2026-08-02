import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommissionOperationsPanel } from '../CommissionOperationsPanel';
import type { CommissionAdminQueues } from '@/lib/commissions/adminQueues';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/actions/commissionManagement', () => ({
    validateCommissionAction: vi.fn(),
    resolveCommissionAdjustmentAction: vi.fn(),
    proposePermanenceDecommissionAction: vi.fn(),
}));

const queues: CommissionAdminQueues = {
    validation: [{
        id: 'commission-1',
        commercialId: 'agent-1',
        commercialName: 'Ana Comercial',
        commercialEmail: 'ana@example.test',
        clientName: 'Taller Norte',
        proposalId: '11111111-1111-4111-8111-111111111111',
        originalAmount: 400,
        reversedAmount: 0,
        netAmount: 400,
        fiscalReady: true,
        referenceAt: '2026-08-01T00:00:00.000Z',
    }],
    settlement: [{
        id: 'commission-2',
        commercialId: 'agent-2',
        commercialName: 'Luis Comercial',
        commercialEmail: null,
        clientName: 'Hotel Centro',
        proposalId: null,
        originalAmount: 300,
        reversedAmount: 50,
        netAmount: 250,
        fiscalReady: false,
        referenceAt: '2026-08-02T00:00:00.000Z',
    }],
    adjustments: [{
        id: 'adjustment-1',
        commissionId: 'commission-3',
        commercialName: 'Marta Comercial',
        clientName: 'Bar Sur',
        causeLabel: 'Cambio anticipado de comercializadora',
        activeDays: 40,
        reversalPercent: 50,
        reversedAmount: 125,
        evidenceReference: 'liquidacion-agosto-linea-4',
        proposedAt: '2026-08-03T00:00:00.000Z',
    }],
    reconciliation: [{
        commissionId: 'commission-4',
        commercialId: 'agent-4',
        lifecycleStatus: 'pending',
        reconciliationStatus: 'plan_unassigned',
        requiredAction: 'Asignar plan económico',
        createdAt: '2026-08-03T00:00:00.000Z',
    }],
    attentionCount: 2,
};

describe('CommissionOperationsPanel', () => {
    it('keeps validation, settlement and attention as focused queues', () => {
        render(<CommissionOperationsPanel queues={queues} permanenceCandidates={[]} />);

        expect(screen.getByText('Taller Norte')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: /Liquidar/ }));
        expect(screen.getByText('Hotel Centro')).toBeTruthy();
        expect(screen.getByText('Faltan datos fiscales')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Ajustes y conciliación/ }));
        expect(screen.getByText('Bar Sur')).toBeTruthy();
        expect(screen.getByText('Asignar plan económico')).toBeTruthy();
    });

    it('requires an explicit validation reason before confirmation', () => {
        render(<CommissionOperationsPanel queues={queues} permanenceCandidates={[]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Validar' }));

        const reason = screen.getByLabelText('Motivo de validación');
        const confirm = screen.getByRole('button', { name: 'Confirmar validación' });
        fireEvent.change(reason, { target: { value: '' } });
        expect((confirm as HTMLButtonElement).disabled).toBe(true);
    });

    it('previews the server-equivalent proportional permanence calculation', () => {
        render(<CommissionOperationsPanel queues={queues} permanenceCandidates={[{
            commissionId: '11111111-1111-4111-8111-111111111111',
            contractId: '22222222-2222-4222-8222-222222222222',
            clientName: 'Industria Norte',
            commercialName: 'Ana Comercial',
            startDate: '2026-01-01',
            endDate: '2027-01-01',
        }]} />);

        fireEvent.click(screen.getByRole('button', { name: /Ajustes y conciliación/ }));
        fireEvent.change(screen.getByLabelText('Operación'), {
            target: { value: '11111111-1111-4111-8111-111111111111' },
        });
        fireEvent.change(screen.getByLabelText('Fecha efectiva de baja'), {
            target: { value: '2026-07-02' },
        });

        expect(screen.getByText(/183 de 365 días pendientes · 50.14 %/)).toBeTruthy();
    });
});
