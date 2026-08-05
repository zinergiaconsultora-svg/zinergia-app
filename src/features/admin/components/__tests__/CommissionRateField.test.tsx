import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { getRatesMock, setRateMock } = vi.hoisted(() => ({
    getRatesMock: vi.fn(),
    setRateMock: vi.fn(),
}));

vi.mock('@/app/actions/collaboratorCommission', () => ({
    getCollaboratorRatesAction: getRatesMock,
    setCollaboratorRateAction: setRateMock,
}));

import { CommissionRateField } from '../CommissionRateField';

const PERFIL = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
    getRatesMock.mockResolvedValue([]);
    setRateMock.mockResolvedValue({ success: true, data: null });
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('CommissionRateField', () => {
    // Un colaborador sin porcentaje no cobra nada por lo que venda. Que eso pase
    // desapercibido al darlo de alta es el error caro de esta pantalla.
    it('avisa cuando el colaborador no tiene comisión configurada', async () => {
        render(<CommissionRateField profileId={PERFIL} />);

        expect(await screen.findByText(/no cobraría nada por sus ventas/i)).toBeTruthy();
        expect(screen.getByText('Sin configurar')).toBeTruthy();
    });

    it('muestra el porcentaje vigente', async () => {
        getRatesMock.mockResolvedValue([
            { rateBps: 6500, effectiveFrom: '2026-08-01T10:00:00Z', note: null },
        ]);

        render(<CommissionRateField profileId={PERFIL} />);

        expect(await screen.findByText('65 %')).toBeTruthy();
        expect(screen.queryByText(/no cobraría nada/i)).toBeNull();
    });

    it('guarda el porcentaje convertido a puntos básicos', async () => {
        render(<CommissionRateField profileId={PERFIL} />);
        await screen.findByText('Sin configurar');

        fireEvent.change(screen.getByLabelText(/Nuevo porcentaje/i), { target: { value: '65' } });
        fireEvent.change(screen.getByLabelText(/Nota del cambio/i), { target: { value: 'Alta inicial' } });
        fireEvent.click(screen.getByRole('button', { name: /Guardar comisión/i }));

        await waitFor(() => expect(setRateMock).toHaveBeenCalledWith({
            profileId: PERFIL,
            rateBps: 6500,
            note: 'Alta inicial',
        }));
    });

    it('acepta la coma decimal', async () => {
        render(<CommissionRateField profileId={PERFIL} />);
        await screen.findByText('Sin configurar');

        fireEvent.change(screen.getByLabelText(/Nuevo porcentaje/i), { target: { value: '62,5' } });
        fireEvent.click(screen.getByRole('button', { name: /Guardar comisión/i }));

        await waitFor(() => expect(setRateMock).toHaveBeenCalledWith(
            expect.objectContaining({ rateBps: 6250 }),
        ));
    });

    // Con el campo vacío el botón no debe poder pulsarse: guardar "nada" fijaría
    // un 0 % que nadie escribió.
    it('no deja guardar con el campo vacío ni con un valor imposible', async () => {
        render(<CommissionRateField profileId={PERFIL} />);
        await screen.findByText('Sin configurar');

        const boton = screen.getByRole('button', { name: /Guardar comisión/i });
        expect(boton.hasAttribute('disabled')).toBe(true);

        fireEvent.change(screen.getByLabelText(/Nuevo porcentaje/i), { target: { value: '150' } });
        expect(boton.hasAttribute('disabled')).toBe(true);

        fireEvent.change(screen.getByLabelText(/Nuevo porcentaje/i), { target: { value: '65' } });
        expect(boton.hasAttribute('disabled')).toBe(false);
    });

    it('enseña el motivo cuando el servidor rechaza el cambio', async () => {
        setRateMock.mockResolvedValue({ success: false, error: 'No tienes permiso para cambiar comisiones.' });
        render(<CommissionRateField profileId={PERFIL} />);
        await screen.findByText('Sin configurar');

        fireEvent.change(screen.getByLabelText(/Nuevo porcentaje/i), { target: { value: '65' } });
        fireEvent.click(screen.getByRole('button', { name: /Guardar comisión/i }));

        expect(await screen.findByRole('alert')).toHaveProperty(
            'textContent',
            'No tienes permiso para cambiar comisiones.',
        );
    });

    // Cambiar el porcentaje no reescribe lo ya cerrado, así que el historial es lo
    // que permite explicar por qué una operación antigua pagó otra cosa.
    it('deja consultar el historial cuando hay más de un porcentaje', async () => {
        getRatesMock.mockResolvedValue([
            { rateBps: 7000, effectiveFrom: '2026-08-05T10:00:00Z', note: 'Subida' },
            { rateBps: 6000, effectiveFrom: '2026-01-01T10:00:00Z', note: null },
        ]);

        render(<CommissionRateField profileId={PERFIL} />);

        expect(await screen.findByText(/Historial \(2\)/)).toBeTruthy();
        expect(screen.getByText(/60 % desde/)).toBeTruthy();
    });

    it('no muestra historial cuando solo hay un porcentaje', async () => {
        getRatesMock.mockResolvedValue([
            { rateBps: 6500, effectiveFrom: '2026-08-01T10:00:00Z', note: null },
        ]);

        render(<CommissionRateField profileId={PERFIL} />);

        await screen.findByText('65 %');
        expect(screen.queryByText(/Historial/)).toBeNull();
    });
});
