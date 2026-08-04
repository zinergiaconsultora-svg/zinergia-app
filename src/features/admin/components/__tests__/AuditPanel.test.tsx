import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getAuditLogAction } from '@/app/actions/auditLog';
import AuditPanel from '../AuditPanel';

vi.mock('@/app/actions/auditLog', () => ({
    getAuditLogAction: vi.fn(),
}));

describe('AuditPanel', () => {
    it('uses a clear Spanish title and one compact activity filter', async () => {
        vi.mocked(getAuditLogAction).mockResolvedValue({
            entries: [],
            actions: ['clear_commission'],
            total: 0,
        });

        render(
            <AuditPanel
                initialData={{
                    entries: [],
                    actions: ['clear_commission'],
                    total: 0,
                }}
            />,
        );

        expect(
            screen.getByRole('heading', { name: 'Historial de actividad' }),
        ).toBeTruthy();
        expect(screen.getAllByRole('combobox')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'Comisión validada' })).toBeNull();

        fireEvent.change(screen.getByRole('combobox'), {
            target: { value: 'clear_commission' },
        });

        await waitFor(() =>
            expect(getAuditLogAction).toHaveBeenCalledWith({
                action: 'clear_commission',
                limit: 50,
                offset: 0,
            }),
        );
    });
});
