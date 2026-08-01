import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RenewalAttentionPanel from '../RenewalAttentionPanel';

const mocks = vi.hoisted(() => ({
    confirm: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
}));

vi.mock('@/app/actions/workQueue', () => ({
    confirmContractPermanenceAction: mocks.confirm,
}));
vi.mock('sonner', () => ({ toast: { success: mocks.success, error: mocks.error } }));

const item = {
    contractId: '11111111-1111-4111-8111-111111111111',
    clientId: '22222222-2222-4222-8222-222222222222',
    clientName: 'Cliente Norte',
    supplyLabel: 'Electricidad · AA1F',
    ownerId: '33333333-3333-4333-8333-333333333333',
    ownerName: 'Ana Comercial',
    marketerName: 'Energia Clara',
    tariffName: '2.0TD',
    startDate: '2026-01-01',
};

describe('RenewalAttentionPanel', () => {
    beforeEach(() => vi.clearAllMocks());

    it('keeps save disabled until a known end date is entered', () => {
        render(<RenewalAttentionPanel items={[item]} />);

        expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(screen.getByLabelText('Fecha de vencimiento'), { target: { value: '2026-09-01' } });
        expect((screen.getByRole('button', { name: 'Guardar' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('supports an explicit no-permanence decision without asking for a date', async () => {
        mocks.confirm.mockResolvedValue({ ok: true });
        render(<RenewalAttentionPanel items={[item]} showOwner />);

        fireEvent.change(screen.getByLabelText('Permanencia'), { target: { value: 'none' } });
        expect(screen.queryByLabelText('Fecha de vencimiento')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => expect(mocks.confirm).toHaveBeenCalledWith({
            contractId: item.contractId,
            permanenceStatus: 'none',
            endDate: null,
        }));
        expect(mocks.success).toHaveBeenCalledWith('Vencimiento actualizado');
        expect(screen.queryByText('Cliente Norte')).toBeNull();
    });
});
