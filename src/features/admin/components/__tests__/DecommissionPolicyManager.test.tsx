import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDecommissionPolicyAction } from '@/app/actions/commissionManagement';
import { DecommissionPolicyManager } from '../DecommissionPolicyManager';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/actions/commissionManagement', () => ({
    createDecommissionPolicyAction: vi.fn(),
}));

describe('DecommissionPolicyManager', () => {
    beforeEach(() => vi.clearAllMocks());

    it('builds a continuous default policy and requires a marketer', () => {
        render(<DecommissionPolicyManager policies={[]} />);

        const save = screen.getByRole('button', { name: 'Guardar política' }) as HTMLButtonElement;
        expect(save.disabled).toBe(true);

        fireEvent.change(screen.getByLabelText('Comercializadora'), { target: { value: 'Iberdrola' } });
        expect(save.disabled).toBe(false);
        expect(screen.getByText('Desde 0')).toBeTruthy();
        expect(screen.getByText('Desde 31')).toBeTruthy();
        expect(screen.getByText('Desde 91')).toBeTruthy();
    });

    it('rejects reversal percentages that increase with active days', () => {
        render(<DecommissionPolicyManager policies={[]} />);
        fireEvent.change(screen.getByLabelText('Comercializadora'), { target: { value: 'Endesa' } });

        const reversalInputs = screen.getAllByLabelText('Devolución %');
        fireEvent.change(reversalInputs[0], { target: { value: '40' } });

        expect(screen.getByRole('alert')).toBeTruthy();
        expect((screen.getByRole('button', { name: 'Guardar política' }) as HTMLButtonElement).disabled).toBe(true);
    });

    it('submits normalized continuous bands through one action', async () => {
        vi.mocked(createDecommissionPolicyAction).mockResolvedValue({ success: true, data: 'policy-1' });
        render(<DecommissionPolicyManager policies={[]} />);
        fireEvent.change(screen.getByLabelText('Comercializadora'), { target: { value: 'Naturgy' } });
        fireEvent.change(screen.getByLabelText('Producto (opcional)'), { target: { value: 'Luz 2.0TD' } });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar política' }));

        await waitFor(() => expect(createDecommissionPolicyAction).toHaveBeenCalledWith({
            marketerName: 'Naturgy',
            productCode: 'Luz 2.0TD',
            consolidationDays: 30,
            clawbackDays: 180,
            bands: [
                { activeDayFrom: 0, activeDayTo: 30, reversalPercent: 100 },
                { activeDayFrom: 31, activeDayTo: 90, reversalPercent: 50 },
                { activeDayFrom: 91, activeDayTo: 180, reversalPercent: 25 },
            ],
        }));
    });
});
