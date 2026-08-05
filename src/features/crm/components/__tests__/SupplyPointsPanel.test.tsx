import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { getPointsMock, createMock, deleteMock, toastSuccessMock, toastErrorMock } = vi.hoisted(() => ({
    getPointsMock: vi.fn(),
    createMock: vi.fn(),
    deleteMock: vi.fn(),
    toastSuccessMock: vi.fn(),
    toastErrorMock: vi.fn(),
}));

vi.mock('@/app/actions/energy', () => ({
    getSupplyPointsAction: getPointsMock,
    createSupplyPointAction: createMock,
    deleteSupplyPointAction: deleteMock,
}));

vi.mock('sonner', () => ({
    toast: { success: toastSuccessMock, error: toastErrorMock },
}));

vi.mock('../SipsConsentControl', () => ({ default: () => null }));

import SupplyPointsPanel from '../SupplyPointsPanel';

const CLIENTE = '11111111-1111-4111-8111-111111111111';
const CUPS = 'ES0021000000000000AB';

function punto(overrides: Record<string, unknown> = {}) {
    return {
        id: '33333333-3333-4333-8333-333333333333',
        client_id: CLIENTE,
        cups: CUPS,
        supply_type: 'electricity',
        address: null,
        current_marketer: null,
        is_primary: false,
        ...overrides,
    };
}

async function abrirFormulario() {
    render(<SupplyPointsPanel clientId={CLIENTE} />);
    fireEvent.click(await screen.findByRole('button', { name: /Añadir punto de suministro/i }));
    return {
        cups: screen.getByLabelText(/CUPS del nuevo punto/i),
        direccion: screen.getByLabelText(/Dirección del punto/i),
        comercializadora: screen.getByLabelText(/Comercializadora actual/i),
        añadir: screen.getByRole('button', { name: /^Añadir$/ }),
    };
}

beforeEach(() => {
    getPointsMock.mockResolvedValue([]);
    createMock.mockResolvedValue(punto());
    deleteMock.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('SupplyPointsPanel — lo que se ve', () => {
    it('dice que no hay nada cuando el cliente no tiene suministros', async () => {
        render(<SupplyPointsPanel clientId={CLIENTE} />);

        expect(await screen.findByText(/Sin puntos de suministro registrados/i)).toBeTruthy();
    });

    it('avisa si no se pueden cargar, en vez de aparentar que no hay ninguno', async () => {
        getPointsMock.mockRejectedValue(new Error('No se pudieron cargar los suministros'));

        render(<SupplyPointsPanel clientId={CLIENTE} />);

        await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('No se pudieron cargar los suministros'));
    });

    it('marca cuál es el principal', async () => {
        getPointsMock.mockResolvedValue([punto({ is_primary: true })]);

        render(<SupplyPointsPanel clientId={CLIENTE} />);

        expect(await screen.findByText('PRINCIPAL')).toBeTruthy();
    });
});

describe('SupplyPointsPanel — alta de un suministro', () => {
    it('crea el punto con lo que se ha escrito', async () => {
        const campos = await abrirFormulario();

        fireEvent.change(campos.cups, { target: { value: CUPS.toLowerCase() } });
        fireEvent.change(campos.direccion, { target: { value: 'Calle Mayor 1' } });
        fireEvent.change(campos.comercializadora, { target: { value: 'NATURGY' } });
        fireEvent.click(campos.añadir);

        await waitFor(() => expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
            clientId: CLIENTE,
            cups: CUPS,
            supplyType: 'electricity',
            address: 'Calle Mayor 1',
            currentMarketer: 'NATURGY',
        })));
        expect(toastSuccessMock).toHaveBeenCalledWith('Punto de suministro añadido');
    });

    // Sin CUPS no hay punto de suministro: es lo único que lo identifica.
    it('no llama al servidor si falta el CUPS', async () => {
        const campos = await abrirFormulario();

        fireEvent.click(campos.añadir);

        expect(createMock).not.toHaveBeenCalled();
        expect(toastErrorMock).toHaveBeenCalledWith('El CUPS es obligatorio');
    });

    // El servidor rechaza los CUPS con formato inválido. Ese motivo tiene que
    // llegar al comercial: "no es un CUPS válido" se corrige, un fallo mudo no.
    it('enseña el motivo cuando el servidor rechaza el CUPS', async () => {
        createMock.mockRejectedValue(new Error('El CUPS no tiene un formato válido'));
        const campos = await abrirFormulario();

        fireEvent.change(campos.cups, { target: { value: 'no-es-un-cups' } });
        fireEvent.click(campos.añadir);

        await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('El CUPS no tiene un formato válido'));
        expect(toastSuccessMock).not.toHaveBeenCalled();
    });

    it('se puede cerrar el formulario sin crear nada', async () => {
        await abrirFormulario();

        fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));

        await waitFor(() => expect(screen.queryByLabelText(/CUPS del nuevo punto/i)).toBeNull());
        expect(createMock).not.toHaveBeenCalled();
    });
});

describe('SupplyPointsPanel — baja de un suministro', () => {
    it('lo quita de la lista al eliminarlo', async () => {
        getPointsMock.mockResolvedValue([punto()]);

        render(<SupplyPointsPanel clientId={CLIENTE} />);
        fireEvent.click(await screen.findByRole('button', { name: /Eliminar punto de suministro/i }));

        await waitFor(() => expect(deleteMock).toHaveBeenCalledWith(punto().id, CLIENTE));
        expect(toastSuccessMock).toHaveBeenCalledWith('Punto eliminado');
    });

    it('deja el punto en su sitio si el borrado falla', async () => {
        getPointsMock.mockResolvedValue([punto()]);
        deleteMock.mockRejectedValue(new Error('No se pudo eliminar'));

        render(<SupplyPointsPanel clientId={CLIENTE} />);
        fireEvent.click(await screen.findByRole('button', { name: /Eliminar punto de suministro/i }));

        await waitFor(() => expect(toastErrorMock).toHaveBeenCalledWith('No se pudo eliminar'));
        expect(screen.getByText(CUPS)).toBeTruthy();
    });
});
