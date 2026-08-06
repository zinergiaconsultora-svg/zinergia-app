import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const { getSettingsMock, saveSettingsMock, getHierarchyMock } = vi.hoisted(() => ({
    getSettingsMock: vi.fn(),
    saveSettingsMock: vi.fn(),
    getHierarchyMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/app/actions/profile', () => ({
    getProfileSettingsAction: getSettingsMock,
    saveProfileSettingsAction: saveSettingsMock,
}));

vi.mock('@/app/actions/commissionRules', () => ({
    saveCommissionRule: vi.fn(),
}));

vi.mock('@/services/crmService', () => ({
    crmService: { getNetworkHierarchy: getHierarchyMock, analyzeDocument: vi.fn() },
}));

// Carga sus propios datos y tiene su propio test.
vi.mock('../FiscalProfileForm', () => ({
    FiscalProfileForm: () => <div data-testid="formulario-fiscal" />,
}));

import SettingsView from '../SettingsView';

const AJUSTES = { companyName: 'Zinergia', nif: 'B00000000', address: 'Calle Uno', defaultMargin: 2.5, defaultVat: 21 };

async function renderizar(props: { canManageCommissions?: boolean } = {}) {
    const vista = render(<SettingsView {...props} />);
    await waitFor(() => expect(getSettingsMock).toHaveBeenCalled());
    return vista;
}

function pestaña(nombre: RegExp) {
    return screen.getAllByRole('button', { name: nombre })[0];
}

beforeEach(() => {
    getSettingsMock.mockResolvedValue(AJUSTES);
    saveSettingsMock.mockResolvedValue(undefined);
    getHierarchyMock.mockResolvedValue([]);
});

afterEach(() => {
    vi.clearAllMocks();
});

/**
 * La pestaña "Red" enseña el reparto económico de la casa: venta directa,
 * franquicia, colaborador y rápeles. Un colaborador que la abría veía cuánto se
 * queda la empresa de cada venta suya — información de negociación en manos de
 * la otra parte de la negociación.
 */
describe('SettingsView — quién ve la pestaña Red', () => {
    it('no existe para un colaborador', async () => {
        await renderizar({ canManageCommissions: false });

        expect(screen.queryByRole('button', { name: /^Red$/ })).toBeNull();
        expect(screen.queryByText(/Configuración de Comisiones/i)).toBeNull();
    });

    it('sigue existiendo para quien configura comisiones', async () => {
        await renderizar({ canManageCommissions: true });

        expect(screen.getByRole('button', { name: /^Red$/ })).toBeTruthy();
    });

    it('y su contenido solo se pinta con ese permiso', async () => {
        await renderizar({ canManageCommissions: true });

        fireEvent.click(screen.getByRole('button', { name: /^Red$/ }));

        expect(await screen.findByText(/Configuración de Comisiones/i)).toBeTruthy();
    });

    // La tabla preguntaba solo "¿es franquicia?", y todo lo demás caía en
    // "Colaborador": la cuenta de administración salía listada como un
    // colaborador más, que es justo lo contrario de lo que sostiene su autoridad.
    it('distingue los tres roles y no llama colaborador al administrador', async () => {
        getHierarchyMock.mockResolvedValue([
            { id: 'ad-1', full_name: 'Admin Zinergia', role: 'admin', children: [] },
            { id: 'fr-1', full_name: 'Franquicia Norte', role: 'franchise', children: [] },
            { id: 'ag-1', full_name: 'Juan Muñoz', role: 'agent', children: [] },
        ]);
        await renderizar({ canManageCommissions: true });

        fireEvent.click(screen.getByRole('button', { name: /^Red$/ }));

        expect(await screen.findByText('Administración')).toBeTruthy();
        expect(screen.getByText('Franquicia')).toBeTruthy();
        expect(screen.getByText('Colaborador')).toBeTruthy();
    });
});

describe('SettingsView — pestañas del colaborador', () => {
    it('abre en Perfil con los datos ya cargados', async () => {
        await renderizar({ canManageCommissions: false });

        expect(screen.getByText(/Datos de empresa/i)).toBeTruthy();
        // Se espera al valor, no a que la carga se haya llamado: entre lo segundo
        // y lo primero hay un cambio de estado, y en una máquina rápida el test
        // miraba antes de que llegara.
        expect(await screen.findByDisplayValue('Zinergia')).toBeTruthy();
    });

    it('lleva a Datos Fiscales, que es donde se factura', async () => {
        await renderizar({ canManageCommissions: false });

        fireEvent.click(pestaña(/Datos Fiscales/));

        expect(await screen.findByTestId('formulario-fiscal')).toBeTruthy();
    });

    it('muestra Operativa con sus condiciones por defecto', async () => {
        await renderizar({ canManageCommissions: false });

        fireEvent.click(pestaña(/Operativa/));

        expect(await screen.findByText(/Condiciones Económicas/i)).toBeTruthy();
        expect(screen.getByLabelText(/Margen Comercial/i)).toBeTruthy();
    });
});

describe('SettingsView — guardar', () => {
    it('envía los ajustes editados', async () => {
        await renderizar({ canManageCommissions: false });

        fireEvent.change(await screen.findByDisplayValue('Zinergia'), { target: { value: 'Zinergia Sur' } });
        fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

        await waitFor(() => expect(saveSettingsMock).toHaveBeenCalledWith(
            expect.objectContaining({ companyName: 'Zinergia Sur' }),
        ));
    });

    it('avisa cuando el guardado falla en vez de callar', async () => {
        saveSettingsMock.mockRejectedValue(new Error('No se pudo guardar'));
        await renderizar({ canManageCommissions: false });

        fireEvent.click(screen.getByRole('button', { name: /Guardar/ }));

        expect(await screen.findByText(/No se pudo guardar/i)).toBeTruthy();
    });

    // En Red no hay nada del perfil que guardar: el botón ahí solo confundiría.
    it('esconde el botón en la pestaña Red', async () => {
        await renderizar({ canManageCommissions: true });

        fireEvent.click(screen.getByRole('button', { name: /^Red$/ }));

        await waitFor(() => expect(screen.queryByRole('button', { name: /Guardar/ })).toBeNull());
    });
});
