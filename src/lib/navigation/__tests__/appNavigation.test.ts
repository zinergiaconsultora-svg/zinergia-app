import { describe, expect, it } from 'vitest';
import { getAppNavigation, isNavigationItemActive } from '../appNavigation';

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

    it('gives admin the six approved operational categories', () => {
        const navigation = getAppNavigation('admin');

        expect(navigation.primary.map((item) => item.label)).toEqual([
            'Operaciones',
            'Clientes',
            'Comisiones',
            'Facturación',
            'Equipo',
            'Administración',
        ]);
        expect(navigation.secondary.map((item) => item.label)).toContain(
            'Control OCR',
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
