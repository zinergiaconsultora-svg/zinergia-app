import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { changeAuthorityMock } = vi.hoisted(() => ({
    changeAuthorityMock: vi.fn(),
}));

vi.mock('@/app/actions/admin', () => ({
    changeProfileAuthorityAdminAction: changeAuthorityMock,
}));

import { DeactivateMemberDialog } from '../DeactivateMemberDialog';

const PETICION = '99999999-9999-4999-8999-999999999999';

function perfil(overrides: Record<string, unknown> = {}) {
    return {
        id: '11111111-1111-4111-8111-111111111111',
        email: 'juan@zinergia.test',
        fullName: 'Juan Muñoz',
        role: 'agent' as const,
        parentId: '22222222-2222-4222-8222-222222222222',
        franchiseId: null,
        authorityVersion: 3,
        ...overrides,
    };
}

beforeEach(() => {
    changeAuthorityMock.mockResolvedValue({ success: true, data: { eventId: 'ev-1' } });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('DeactivateMemberDialog — dar de baja', () => {
    // Lo que más preocupa al pulsar este botón es qué se pierde. La pantalla lo
    // dice antes de que haya que preguntarlo.
    it('explica qué pasa y qué no se pierde', () => {
        render(
            <DeactivateMemberDialog
                profile={perfil()}
                requestId={PETICION}
                onClose={vi.fn()}
                onChanged={vi.fn()}
            />,
        );

        expect(screen.getByText(/Perderá el acceso/i)).toBeTruthy();
        expect(screen.getByText(/No se borra nada/i)).toBeTruthy();
        expect(screen.getByText(/comisiones ya liquidadas no cambian/i)).toBeTruthy();
    });

    it('desactiva dejando el perfil sin rol, responsable ni franquicia', async () => {
        const onChanged = vi.fn();
        render(
            <DeactivateMemberDialog
                profile={perfil()}
                requestId={PETICION}
                onClose={vi.fn()}
                onChanged={onChanged}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));

        await waitFor(() => expect(changeAuthorityMock).toHaveBeenCalledWith({
            targetId: perfil().id,
            desiredRole: null,
            parentId: null,
            franchiseId: null,
            expectedAuthorityVersion: 3,
            reasonCode: 'deactivation',
            requestId: PETICION,
        }));
        await waitFor(() => expect(onChanged).toHaveBeenCalled());
    });

    it('enseña el motivo si el servidor lo rechaza y no cierra el diálogo', async () => {
        changeAuthorityMock.mockResolvedValue({ success: false, error: 'Debe permanecer al menos un administrador activo.' });
        const onChanged = vi.fn();
        render(
            <DeactivateMemberDialog
                profile={perfil()}
                requestId={PETICION}
                onClose={vi.fn()}
                onChanged={onChanged}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Dar de baja' }));

        expect(await screen.findByRole('alert')).toHaveProperty(
            'textContent',
            'Debe permanecer al menos un administrador activo.',
        );
        expect(onChanged).not.toHaveBeenCalled();
    });

    it('cancelar no llama al servidor', () => {
        const onClose = vi.fn();
        render(
            <DeactivateMemberDialog
                profile={perfil()}
                requestId={PETICION}
                onClose={onClose}
                onChanged={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

        expect(changeAuthorityMock).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
    });
});

describe('DeactivateMemberDialog — reactivar', () => {
    const dadoDeBaja = perfil({ role: null, parentId: null });

    it('ofrece reactivar cuando el perfil está sin rol', () => {
        render(
            <DeactivateMemberDialog
                profile={dadoDeBaja}
                requestId={PETICION}
                onClose={vi.fn()}
                onChanged={vi.fn()}
            />,
        );

        expect(screen.getByRole('button', { name: 'Reactivar' })).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Dar de baja' })).toBeNull();
    });

    // Devolverlo a colaborador es lo único que admite el modelo actual; si hace
    // falta otra cosa se ajusta después desde "Cambiar autoridad".
    it('lo devuelve como colaborador', async () => {
        render(
            <DeactivateMemberDialog
                profile={dadoDeBaja}
                requestId={PETICION}
                onClose={vi.fn()}
                onChanged={vi.fn()}
            />,
        );

        fireEvent.click(screen.getByRole('button', { name: 'Reactivar' }));

        await waitFor(() => expect(changeAuthorityMock).toHaveBeenCalledWith(
            expect.objectContaining({ desiredRole: 'agent', reasonCode: 'reactivation' }),
        ));
    });

    it('recuerda comprobar su comisión antes de que vuelva a vender', () => {
        render(
            <DeactivateMemberDialog
                profile={dadoDeBaja}
                requestId={PETICION}
                onClose={vi.fn()}
                onChanged={vi.fn()}
            />,
        );

        expect(screen.getByText(/Compruébala antes de que empiece a vender/i)).toBeTruthy();
    });
});
