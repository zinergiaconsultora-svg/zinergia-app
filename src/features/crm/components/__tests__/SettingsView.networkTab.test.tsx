import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { getSettingsMock, getHierarchyMock } = vi.hoisted(() => ({
    getSettingsMock: vi.fn(),
    getHierarchyMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    useRouter: () => ({ back: vi.fn(), push: vi.fn() }),
}));

vi.mock('@/app/actions/profile', () => ({
    getProfileSettingsAction: getSettingsMock,
    saveProfileSettingsAction: vi.fn(),
}));

vi.mock('@/app/actions/commissionRules', () => ({
    saveCommissionRule: vi.fn(),
}));

vi.mock('@/services/crmService', () => ({
    crmService: { getNetworkHierarchy: getHierarchyMock, analyzeDocument: vi.fn() },
}));

// El formulario fiscal carga sus propios datos y tiene sus propios tests.
vi.mock('../FiscalProfileForm', () => ({
    FiscalProfileForm: () => null,
}));

import SettingsView from '../SettingsView';

beforeEach(() => {
    getSettingsMock.mockResolvedValue({ companyName: '', nif: '', address: '', defaultMargin: 2.5, defaultVat: 21 });
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
describe('SettingsView — pestaña Red', () => {
    it('no existe para un colaborador', async () => {
        render(<SettingsView canManageCommissions={false} />);

        await waitFor(() => expect(getSettingsMock).toHaveBeenCalled());
        expect(screen.queryByRole('button', { name: /Red/ })).toBeNull();
        expect(screen.queryByText(/Configuración de Comisiones/i)).toBeNull();
    });

    it('sigue existiendo para quien configura comisiones', async () => {
        render(<SettingsView canManageCommissions />);

        await waitFor(() => expect(getSettingsMock).toHaveBeenCalled());
        expect(screen.getByRole('button', { name: /Red/ })).toBeTruthy();
    });

    it('el colaborador conserva sus pestañas de trabajo', async () => {
        render(<SettingsView canManageCommissions={false} />);

        await waitFor(() => expect(getSettingsMock).toHaveBeenCalled());
        expect(screen.getByRole('button', { name: /Perfil/ })).toBeTruthy();
        // Hay dos botones que contienen "Datos Fiscales": la pestaña y el atajo
        // "Ir a Datos Fiscales". Basta con que exista al menos la pestaña.
        expect(screen.getAllByRole('button', { name: /Datos Fiscales/ }).length).toBeGreaterThanOrEqual(1);
    });
});
