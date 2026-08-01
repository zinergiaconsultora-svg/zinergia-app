import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setupCommissionModelAction } from '@/app/actions/commissionManagement';
import { CommissionModelSetup } from '../CommissionModelSetup';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/actions/commissionManagement', () => ({
    setupCommissionModelAction: vi.fn(),
}));

const commercials = Array.from({ length: 6 }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    name: `Socio ${index + 1}`,
    email: `socio${index + 1}@example.test`,
    role: 'agent',
}));

describe('CommissionModelSetup', () => {
    beforeEach(() => vi.clearAllMocks());

    it('starts with two balanced channel models', () => {
        render(<CommissionModelSetup actorId="admin-1" commercials={commercials} />);

        expect(screen.getByRole('heading', { name: 'Configuración inicial' })).toBeTruthy();
        expect(screen.getByText('25.00 %')).toBeTruthy();
        expect(screen.getByText('40.00 %')).toBeTruthy();
        expect((screen.getByRole('button', { name: 'Guardar configuración' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('limits direct-partner selection to five existing profiles', () => {
        render(<CommissionModelSetup actorId="admin-1" commercials={commercials} />);

        const checkboxes = screen.getAllByRole('checkbox');
        checkboxes.slice(0, 5).forEach((checkbox) => fireEvent.click(checkbox));

        expect(screen.getByText('Seleccionados: 5 de 5.')).toBeTruthy();
        expect((checkboxes[5] as HTMLInputElement).disabled).toBe(true);
    });

    it('submits both plans and selected profiles in one action', async () => {
        vi.mocked(setupCommissionModelAction).mockResolvedValue({
            success: true,
            data: {
                directPlanId: 'direct-plan',
                franchisePlanId: 'franchise-plan',
                assignedCount: 1,
            },
        });
        render(<CommissionModelSetup actorId="admin-1" commercials={commercials.slice(0, 1)} />);

        fireEvent.click(screen.getByRole('checkbox'));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

        await waitFor(() => expect(setupCommissionModelAction).toHaveBeenCalledWith({
            directName: 'Socios directos',
            directCommercialPercent: 75,
            franchiseName: 'Red franquiciada',
            franchiseCommercialPercent: 45,
            franchisePercent: 15,
            directCommercialIds: [commercials[0].id],
        }));
    });
});
