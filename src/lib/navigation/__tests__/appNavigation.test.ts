import { describe, expect, it } from 'vitest';
import { getAdminNavigationGroups, getAppNavigation, isNavigationItemActive } from '../appNavigation';

describe('role-aware app navigation', () => {
    it('keeps the commercial primary navigation focused on daily work', () => {
        const navigation = getAppNavigation('agent');

        expect(navigation.primary.map((item) => item.label)).toEqual([
            'Trabajo',
            'Clientes',
            'Comisiones',
            'Ajustes',
        ]);
        expect(navigation.primary).not.toContainEqual(
            expect.objectContaining({ label: 'Cartera' }),
        );
        expect(navigation.secondary.map((item) => item.label)).toContain(
            'Facturas subidas',
        );
    });

    it('keeps four daily destinations in the admin mobile navigation', () => {
        const navigation = getAppNavigation('admin');

        expect(navigation.primary.map((item) => item.label)).toEqual([
            'Hoy',
            'Clientes',
            'Comisiones',
            'Equipo',
        ]);
        expect(navigation.secondary.map((item) => item.label)).toContain(
            'Procesamiento de facturas',
        );
    });

    it('groups admin tools by commercial, economic, organization and control goals', () => {
        const groups = getAdminNavigationGroups();

        expect(groups.map((group) => group.label)).toEqual([
            'Comercial',
            'Economía',
            'Organización',
            'Control',
        ]);
        expect(groups.flatMap((group) => group.items)).toContainEqual(
            expect.objectContaining({ label: 'Historial de actividad', href: '/admin/audit' }),
        );
        expect(groups.flatMap((group) => group.items)).not.toContainEqual(
            expect.objectContaining({ label: 'Indicadores' }),
        );
    });

    it('adds network management for franchises without promoting it for agents', () => {
        expect(getAppNavigation('franchise').secondary).toContainEqual(
            expect.objectContaining({ label: 'Red comercial' }),
        );
        expect(getAppNavigation('agent').secondary).not.toContainEqual(
            expect.objectContaining({ label: 'Red comercial' }),
        );
    });

    it('matches exact root routes and nested section routes safely', () => {
        expect(isNavigationItemActive('/dashboard', '/dashboard')).toBe(true);
        expect(isNavigationItemActive('/dashboard/clients/123', '/dashboard/clients')).toBe(true);
        expect(isNavigationItemActive('/dashboarding', '/dashboard')).toBe(false);
        expect(isNavigationItemActive('/admin/leads', '/admin')).toBe(false);
    });
});
