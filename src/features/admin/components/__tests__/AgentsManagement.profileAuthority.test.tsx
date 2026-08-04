import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
    changeProfileAuthorityAdminActionMock,
    updateTeamMemberNameActionMock,
    refreshMock,
} = vi.hoisted(() => ({
    changeProfileAuthorityAdminActionMock: vi.fn(),
    updateTeamMemberNameActionMock: vi.fn(),
    refreshMock: vi.fn(),
}));

vi.mock('@/app/actions/admin', () => ({
    changeProfileAuthorityAdminAction: changeProfileAuthorityAdminActionMock,
}));
vi.mock('@/app/actions/network', () => ({
    updateTeamMemberNameAction: updateTeamMemberNameActionMock,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: refreshMock }) }));
vi.mock('framer-motion', async () => {
    const React = await import('react');
    return {
        motion: {
            tr: React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
                function MotionRow({ children, ...props }, ref) {
                    const safeProps = { ...props } as Record<string, unknown>;
                    delete safeProps.layout;
                    return <tr ref={ref} {...safeProps}>{children}</tr>;
                },
            ),
        },
        AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    };
});

import AgentsManagement from '../AgentsManagement';

const adminId = '11111111-1111-4111-8111-111111111111';
const targetId = '22222222-2222-4222-8222-222222222222';
const franchiseId = '44444444-4444-4444-8444-444444444444';

const profile = {
    id: targetId,
    email: 'persona@example.test',
    full_name: 'Persona',
    fullName: 'Persona',
    role: 'agent' as const,
    parent_id: adminId,
    parentId: adminId,
    franchise_id: franchiseId,
    franchiseId,
    authorityVersion: 7,
};

const admin = {
    ...profile,
    id: adminId,
    email: 'admin@example.test',
    full_name: 'Admin',
    fullName: 'Admin',
    role: 'admin' as const,
    parent_id: null,
    parentId: null,
    franchise_id: null,
    franchiseId: null,
    authorityVersion: 3,
};

describe('ZIN-SDD-041 Admin identity and authority UI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        updateTeamMemberNameActionMock.mockResolvedValue({ success: true, data: null });
        changeProfileAuthorityAdminActionMock.mockResolvedValue({
            success: true,
            data: { eventId: '66666666-6666-4666-8666-666666666666' },
        });
    });

    it('offers separate identity and authority operations', () => {
        render(<AgentsManagement agents={[profile, admin]} franchises={[]} />);

        expect(screen.getByRole('button', { name: /editar nombre de persona/i })).toBeTruthy();
        expect(screen.getByRole('button', { name: /cambiar autoridad de persona/i })).toBeTruthy();
        expect(screen.queryByRole('button', { name: /guardar cambios del agente/i })).toBeNull();
    });

    it('saves identity without sending any authority field', async () => {
        render(<AgentsManagement agents={[profile, admin]} franchises={[]} />);

        fireEvent.click(screen.getByRole('button', { name: /editar nombre de persona/i }));
        fireEvent.change(screen.getByRole('textbox', { name: /nombre completo/i }), {
            target: { value: 'Nombre corregido' },
        });
        fireEvent.click(screen.getByRole('button', { name: /guardar nombre/i }));

        await waitFor(() => expect(updateTeamMemberNameActionMock).toHaveBeenCalledWith({
            targetId,
            fullName: 'Nombre corregido',
        }));
        expect(changeProfileAuthorityAdminActionMock).not.toHaveBeenCalled();
    });

    it('opens an accessible confirmation, requires a reason and prevents double submission', async () => {
        let release: ((value: unknown) => void) | undefined;
        changeProfileAuthorityAdminActionMock.mockReturnValue(new Promise(resolve => {
            release = resolve;
        }));
        render(<AgentsManagement agents={[profile, admin]} franchises={[]} />);

        const opener = screen.getByRole('button', { name: /cambiar autoridad de persona/i });
        fireEvent.click(opener);
        const dialog = screen.getByRole('dialog', { name: /cambiar autoridad/i });
        expect(dialog).toBeTruthy();
        expect(screen.getByText(/actual/i)).toBeTruthy();
        expect(screen.getByText(/propuesta/i)).toBeTruthy();
        expect(document.activeElement).toBe(screen.getByRole('combobox', { name: /rol propuesto/i }));

        fireEvent.change(screen.getByRole('combobox', { name: /rol propuesto/i }), {
            target: { value: 'deactivated' },
        });
        const submit = screen.getByRole('button', { name: /confirmar cambio/i });
        expect((submit as HTMLButtonElement).disabled).toBe(true);
        fireEvent.change(screen.getByRole('combobox', { name: /motivo/i }), {
            target: { value: 'deactivation' },
        });
        fireEvent.click(submit);
        fireEvent.click(submit);

        expect(changeProfileAuthorityAdminActionMock).toHaveBeenCalledTimes(1);
        expect(changeProfileAuthorityAdminActionMock).toHaveBeenCalledWith({
            targetId,
            desiredRole: null,
            parentId: null,
            franchiseId: null,
            expectedAuthorityVersion: 7,
            reasonCode: 'deactivation',
            requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        });
        expect((submit as HTMLButtonElement).disabled).toBe(true);

        release?.({ success: true, data: { eventId: 'event-id' } });
        await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    });

    it('closes on Escape and restores focus to the authority trigger', () => {
        render(<AgentsManagement agents={[profile, admin]} franchises={[]} />);

        const opener = screen.getByRole('button', { name: /cambiar autoridad de persona/i });
        fireEvent.click(opener);
        fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

        expect(screen.queryByRole('dialog')).toBeNull();
        expect(document.activeElement).toBe(opener);
        expect(changeProfileAuthorityAdminActionMock).not.toHaveBeenCalled();
    });
});
