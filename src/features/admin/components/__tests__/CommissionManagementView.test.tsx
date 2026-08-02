import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CommissionManagementView } from '../CommissionManagementView';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/actions/commissionManagement', () => ({
    createCommissionPlanAction: vi.fn(),
    assignCommissionPlanAction: vi.fn(),
    setupCommissionModelAction: vi.fn(),
    createDecommissionPolicyAction: vi.fn(),
}));

const emptyData = {
    actorId: 'admin-1',
    plans: [],
    commercials: [],
    assignments: [],
    policies: [],
    reconciliation: [],
    permanenceCandidates: [],
    operations: {
        validation: [],
        settlement: [],
        adjustments: [],
        reconciliation: [],
        attentionCount: 0,
    },
};

const configuredData = {
    ...emptyData,
    plans: [
        {
            id: 'direct-plan',
            name: 'Socios directos',
            channel: 'partner_direct' as const,
            version: 1,
            commercialShareBps: 7500,
            franchiseShareBps: 0,
            centralShareBps: 2500,
            effectiveFrom: '2026-08-01T00:00:00Z',
            effectiveTo: null,
            isActive: true,
        },
        {
            id: 'franchise-plan',
            name: 'Red franquiciada',
            channel: 'franchise_network' as const,
            version: 1,
            commercialShareBps: 4500,
            franchiseShareBps: 1500,
            centralShareBps: 4000,
            effectiveFrom: '2026-08-01T00:00:00Z',
            effectiveTo: null,
            isActive: true,
        },
    ],
};

describe('CommissionManagementView', () => {
    it('calculates Zinergia as the direct-plan remainder and keeps franchise at zero', () => {
        render(<CommissionManagementView initialData={configuredData} />);

        const inputs = screen.getAllByRole('spinbutton');
        fireEvent.change(inputs[0], { target: { value: '80' } });

        expect(screen.getByText('20.00 %')).toBeTruthy();
        expect((inputs[1] as HTMLInputElement).disabled).toBe(true);
        expect((inputs[1] as HTMLInputElement).value).toBe('0');
    });

    it('enables franchise percentage only for the franchise network channel', () => {
        render(<CommissionManagementView initialData={configuredData} />);

        fireEvent.click(screen.getByRole('button', { name: 'Franquicia' }));
        const inputs = screen.getAllByRole('spinbutton');

        expect((inputs[1] as HTMLInputElement).disabled).toBe(false);
        expect(screen.getAllByText('25.00 %').length).toBeGreaterThan(0);
    });
});
