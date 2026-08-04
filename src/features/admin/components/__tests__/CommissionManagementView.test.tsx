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

        expect(
            screen.getByRole('heading', { name: 'Editar reparto comercial' }),
        ).toBeTruthy();

        const commercialInput = screen.getByRole('spinbutton', {
            name: 'Socio comercial %',
        });
        fireEvent.change(commercialInput, { target: { value: '80' } });

        expect(screen.getAllByText('20.00 %')).toHaveLength(2);
        expect(
            screen.queryByRole('spinbutton', { name: 'Franquicia %' }),
        ).toBeNull();
    });

    it('enables franchise percentage only for the franchise network channel', () => {
        render(<CommissionManagementView initialData={configuredData} />);

        fireEvent.click(
            screen.getByRole('button', { name: 'Red franquiciada' }),
        );

        expect(
            screen.getByRole('spinbutton', { name: 'Franquicia %' }),
        ).toBeTruthy();
        expect(screen.getAllByText('40.00 %').length).toBeGreaterThan(0);
    });

    it('only enables versioning after the current split has changed', () => {
        render(<CommissionManagementView initialData={configuredData} />);

        const saveButton = screen.getByRole('button', {
            name: 'Guardar como v2',
        });
        expect((saveButton as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(
            screen.getByRole('spinbutton', { name: 'Socio comercial %' }),
            {
                target: { value: '80' },
            },
        );

        expect((saveButton as HTMLButtonElement).disabled).toBe(false);
    });

    it('uses the active franchise plan when no direct plan exists', () => {
        render(<CommissionManagementView initialData={{
            ...configuredData,
            plans: [configuredData.plans[1]],
        }} />);

        expect(screen.getByRole('spinbutton', { name: 'Franquicia %' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Red franquiciada' }).getAttribute('aria-pressed')).toBe('true');
    });
});
