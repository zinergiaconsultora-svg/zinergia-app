import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createInvitationMock, getContextMock, toastErrorMock } = vi.hoisted(() => ({
    createInvitationMock: vi.fn(),
    getContextMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('@/app/actions/network', () => ({
    createInvitationAction: createInvitationMock,
    getInvitationCreationContextAction: getContextMock,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: toastErrorMock } }));
vi.mock('framer-motion', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: { div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div> },
}));

import { InviteModal } from '../InviteModal';

const franchiseId = '22222222-2222-4222-8222-222222222222';

describe('ZIN-SDD-041 invitation creation UI', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        createInvitationMock.mockResolvedValue({
            success: true,
            data: { inviteUrl: 'https://example.test/join/ABC12345', emailSent: true },
        });
    });

    afterEach(cleanup);

    it('requires an active target franchise only for Admin', async () => {
        getContextMock.mockResolvedValue({
            success: true,
            data: {
                role: 'admin',
                activeFranchises: [{ id: franchiseId, name: 'Franquicia Norte' }],
            },
        });
        render(<InviteModal isOpen onClose={vi.fn()} />);

        fireEvent.change(screen.getByLabelText('Email del invitado'), {
            target: { value: 'persona@example.test' },
        });
        await screen.findByLabelText('Franquicia de destino');
        fireEvent.click(screen.getByRole('button', { name: 'Franquicia' }));
        fireEvent.change(screen.getByLabelText('Franquicia de destino'), {
            target: { value: franchiseId },
        });
        fireEvent.click(screen.getByRole('button', { name: /generar enlace/i }));

        await waitFor(() => expect(createInvitationMock).toHaveBeenCalledWith({
            email: 'persona@example.test',
            role: 'franchise',
            targetFranchiseId: franchiseId,
        }));
    });

    it('locks a Franchise creator to Agent without exposing a target selector', async () => {
        getContextMock.mockResolvedValue({
            success: true,
            data: { role: 'franchise', activeFranchises: [] },
        });
        render(<InviteModal isOpen onClose={vi.fn()} />);

        fireEvent.change(screen.getByLabelText('Email del invitado'), {
            target: { value: 'agente@example.test' },
        });
        await screen.findByRole('button', { name: 'Colaborador' });
        expect(screen.queryByRole('button', { name: 'Franquicia' })).toBeNull();
        expect(screen.queryByLabelText('Franquicia de destino')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /generar enlace/i }));

        await waitFor(() => expect(createInvitationMock).toHaveBeenCalledWith({
            email: 'agente@example.test',
            role: 'agent',
        }));
    });

    it('does not display or log provider details when invitation creation fails', async () => {
        getContextMock.mockResolvedValue({
            success: true,
            data: { role: 'franchise', activeFranchises: [] },
        });
        createInvitationMock.mockRejectedValue(new Error('provider rejected persona.privada@example.test'));
        render(<InviteModal isOpen onClose={vi.fn()} />);

        fireEvent.change(screen.getByLabelText('Email del invitado'), {
            target: { value: 'persona.privada@example.test' },
        });
        await screen.findByRole('button', { name: 'Colaborador' });
        fireEvent.click(screen.getByRole('button', { name: /generar enlace/i }));

        await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith(
            'No se pudo generar la invitación. Inténtalo de nuevo.',
        ));
    });
});
