import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationTop } from '../NavigationTop';

const mocks = vi.hoisted(() => ({
    pathname: '/dashboard',
    logout: vi.fn(),
}));

vi.mock('next/navigation', () => ({
    usePathname: () => mocks.pathname,
}));

vi.mock('@/app/auth/actions', () => ({
    logout: mocks.logout,
}));

vi.mock('../ui/NotificationBell', () => ({
    NotificationBell: () => <button type="button" aria-label="Notificaciones" />,
}));

vi.mock('../ui/ZinergiaLogo', () => ({
    ZinergiaLogo: () => <span>Zinergia</span>,
}));

describe('NavigationTop', () => {
    beforeEach(() => {
        mocks.pathname = '/dashboard';
        mocks.logout.mockClear();
    });

    it('renders the focused commercial navigation and persistent invoice action', () => {
        render(<NavigationTop role="agent" />);

        expect(screen.getAllByText('Trabajo').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Clientes').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Comisiones').length).toBeGreaterThan(0);
        expect(screen.queryByText('Operaciones')).toBeNull();
        expect(
            screen.getByRole('link', { name: /nueva factura/i }).getAttribute('href'),
        ).toBe('/dashboard/simulator');
    });

    it('renders all approved admin categories without client-side role lookup', () => {
        mocks.pathname = '/admin';
        render(<NavigationTop role="admin" />);

        for (const label of [
            'Operaciones',
            'Clientes',
            'Comisiones',
            'Facturación',
            'Equipo',
            'Administración',
        ]) {
            expect(screen.getAllByText(label).length).toBeGreaterThan(0);
        }
    });

    it('keeps advanced routes reachable from the secondary menu', () => {
        render(<NavigationTop role="admin" />);

        fireEvent.click(screen.getByRole('button', { name: 'Abrir herramientas' }));

        expect(
            screen.getAllByRole('link', { name: 'Control OCR' })[0].getAttribute('href'),
        ).toBe('/admin/ocr');
        expect(
            screen.getAllByRole('link', { name: 'Protección de datos' })[0].getAttribute('href'),
        ).toBe('/admin/rgpd');
        expect(
            screen.getAllByRole('link', { name: 'Equipo' })[0].getAttribute('href'),
        ).toBe('/admin/agents');
        expect(
            screen.getAllByRole('link', { name: 'Administración' })[0].getAttribute('href'),
        ).toBe('/admin/audit');
    });
});
