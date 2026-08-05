import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const { getSettingsMock, saveSettingsMock, saveRuleMock, getHierarchyMock, analyzeMock } = vi.hoisted(() => ({
    getSettingsMock: vi.fn(),
    saveSettingsMock: vi.fn(),
    saveRuleMock: vi.fn(),
    getHierarchyMock: vi.fn(),
    analyzeMock: vi.fn(),
}));

vi.mock('@/app/actions/profile', () => ({
    getProfileSettingsAction: getSettingsMock,
    saveProfileSettingsAction: saveSettingsMock,
}));

vi.mock('@/app/actions/commissionRules', () => ({ saveCommissionRule: saveRuleMock }));

vi.mock('@/services/crmService', () => ({
    crmService: { getNetworkHierarchy: getHierarchyMock, analyzeDocument: analyzeMock },
}));

import { useSettingsView } from '../useSettingsView';

const AJUSTES = { companyName: 'Zinergia', nif: 'B00000000', address: 'Calle Uno', defaultMargin: 2.5, defaultVat: 21 };

beforeEach(() => {
    getSettingsMock.mockResolvedValue(AJUSTES);
    saveSettingsMock.mockResolvedValue(undefined);
    saveRuleMock.mockResolvedValue(undefined);
    getHierarchyMock.mockResolvedValue([]);
});

afterEach(() => {
    vi.clearAllMocks();
});

describe('useSettingsView — carga', () => {
    it('trae los ajustes guardados al montar', async () => {
        const { result } = renderHook(() => useSettingsView(null));

        await waitFor(() => expect(result.current.settings.companyName).toBe('Zinergia'));
        expect(result.current.activeTab).toBe('profile');
    });

    // Si la carga falla, el formulario se queda con los valores de fábrica. Es
    // preferible eso a una pantalla en blanco, pero no debe tumbar el componente.
    it('sobrevive a un fallo de carga', async () => {
        getSettingsMock.mockRejectedValue(new Error('sin conexión'));

        const { result } = renderHook(() => useSettingsView(null));

        await waitFor(() => expect(getSettingsMock).toHaveBeenCalled());
        expect(result.current.settings.defaultVat).toBe(21);
    });
});

describe('useSettingsView — guardar el perfil', () => {
    it('envía lo editado y confirma', async () => {
        const { result } = renderHook(() => useSettingsView(null));
        await waitFor(() => expect(result.current.settings.companyName).toBe('Zinergia'));

        await act(async () => { await result.current.handleSave(); });

        expect(saveSettingsMock).toHaveBeenCalledWith(expect.objectContaining({ companyName: 'Zinergia' }));
        expect(result.current.saveSuccess).toBe(true);
        expect(result.current.saveError).toBeNull();
    });

    // El guardado del perfil falla hoy contra la base de datos real, por columnas
    // que no existen. Que el motivo llegue a la pantalla es lo que separa "no
    // funciona" de "no sé si ha funcionado".
    it('deja el motivo del fallo a la vista', async () => {
        saveSettingsMock.mockRejectedValue(new Error('columna inexistente'));
        const { result } = renderHook(() => useSettingsView(null));
        await waitFor(() => expect(result.current.settings.companyName).toBe('Zinergia'));

        await act(async () => { await result.current.handleSave(); });

        expect(result.current.saveError).toBe('columna inexistente');
        expect(result.current.saveSuccess).toBe(false);
        expect(result.current.loading).toBe(false);
    });
});

describe('useSettingsView — regla de comisión', () => {
    it('convierte los porcentajes a fracciones antes de enviarlos', async () => {
        const { result } = renderHook(() => useSettingsView(null));

        await act(async () => { await result.current.handleSaveRule(); });

        expect(saveRuleMock).toHaveBeenCalledWith(expect.objectContaining({
            commission_rate: 0.15,
            agent_share: 0.3,
            franchise_share: 0.5,
            hq_share: 0.2,
        }));
        expect(result.current.ruleSuccess).toBe(true);
    });

    it('parte de la regla activa cuando existe', () => {
        const { result } = renderHook(() => useSettingsView({
            name: 'Regla 2026',
            commission_rate: 0.2,
            agent_share: 0.4,
            franchise_share: 0.4,
            hq_share: 0.2,
            points_per_win: 80,
        } as never));

        expect(result.current.ruleForm.name).toBe('Regla 2026');
        expect(result.current.ruleForm.commission_rate).toBe('20.0');
        expect(result.current.ruleForm.points_per_win).toBe('80');
    });

    it('informa si no se pudo guardar la regla', async () => {
        saveRuleMock.mockRejectedValue(new Error('sin permiso'));
        const { result } = renderHook(() => useSettingsView(null));

        await act(async () => { await result.current.handleSaveRule(); });

        expect(result.current.ruleError).toBe('sin permiso');
        expect(result.current.ruleSaving).toBe(false);
    });
});

describe('useSettingsView — red', () => {
    // La jerarquía solo se pide al abrir esa pestaña: es una consulta cara y la
    // mayoría de visitas a Ajustes no la necesitan.
    it('no consulta la jerarquía hasta que se abre la pestaña', async () => {
        const { result } = renderHook(() => useSettingsView(null));
        await waitFor(() => expect(getSettingsMock).toHaveBeenCalled());

        expect(getHierarchyMock).not.toHaveBeenCalled();

        act(() => { result.current.setActiveTab('network'); });

        await waitFor(() => expect(getHierarchyMock).toHaveBeenCalled());
    });

    it('aplana la jerarquía en responsables y sus colaboradores', async () => {
        getHierarchyMock.mockResolvedValue([
            { id: 'f-1', full_name: 'Franquicia Norte', children: [{ id: 'a-1', full_name: 'Ana' }] },
        ]);
        const { result } = renderHook(() => useSettingsView(null));

        act(() => { result.current.setActiveTab('network'); });

        await waitFor(() => expect(result.current.networkNodes).toHaveLength(2));
        expect(result.current.networkNodes.map(n => n.id)).toEqual(['f-1', 'a-1']);
        expect(result.current.networkLoading).toBe(false);
    });
});
