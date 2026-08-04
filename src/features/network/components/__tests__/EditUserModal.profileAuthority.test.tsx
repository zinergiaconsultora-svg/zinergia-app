import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateTeamMemberNameActionMock } = vi.hoisted(() => ({
    updateTeamMemberNameActionMock: vi.fn(),
}));

vi.mock('@/app/actions/network', () => ({
    updateTeamMemberNameAction: updateTeamMemberNameActionMock,
}));

vi.mock('framer-motion', async () => {
    const React = await import('react');
    return {
        motion: {
            div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
                function MotionDiv({ children, ...props }, ref) {
                    const safeProps = { ...props } as Record<string, unknown>;
                    delete safeProps.initial;
                    delete safeProps.animate;
                    delete safeProps.exit;
                    delete safeProps.transition;
                    return <div ref={ref} {...safeProps}>{children}</div>;
                },
            ),
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    };
});

import { EditUserModal } from '../EditUserModal';

const node = {
    id: '22222222-2222-4222-8222-222222222222',
    email: 'persona@example.test',
    full_name: 'Nombre anterior',
    role: 'agent' as const,
};

describe('ZIN-SDD-041 Franchise network identity editor', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateTeamMemberNameActionMock.mockResolvedValue({ success: true, data: null });
    });

    it('shows email as immutable context and exposes no authority or destructive controls', () => {
        render(<EditUserModal node={node} onClose={vi.fn()} onSaved={vi.fn()} />);

        expect(screen.getByText('persona@example.test')).toBeTruthy();
        expect(screen.queryByRole('textbox', { name: /email/i })).toBeNull();
        expect(screen.queryByRole('button', { name: /desactivar|reactivar|eliminar/i })).toBeNull();
        expect(screen.queryByRole('combobox')).toBeNull();
    });

    it('submits only target id and name through the scoped identity action', async () => {
        const onClose = vi.fn();
        const onSaved = vi.fn();
        render(<EditUserModal node={node} onClose={onClose} onSaved={onSaved} />);

        fireEvent.change(screen.getByRole('textbox', { name: /nombre completo/i }), {
            target: { value: 'Nombre corregido' },
        });
        fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

        await waitFor(() => {
            expect(updateTeamMemberNameActionMock).toHaveBeenCalledWith({
                targetId: node.id,
                fullName: 'Nombre corregido',
            });
        });
        expect(onSaved).toHaveBeenCalledWith({ full_name: 'Nombre corregido' });
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('keeps the editor open when the server rejects a stale relationship', async () => {
        const onClose = vi.fn();
        updateTeamMemberNameActionMock.mockResolvedValue({
            success: false,
            error: 'No se pudo actualizar el nombre.',
        });
        render(<EditUserModal node={node} onClose={onClose} onSaved={vi.fn()} />);

        fireEvent.click(screen.getByRole('button', { name: /guardar/i }));

        expect(await screen.findByText('No se pudo actualizar el nombre.')).toBeTruthy();
        expect(onClose).not.toHaveBeenCalled();
    });
});
