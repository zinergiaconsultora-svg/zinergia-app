import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { getTrustedActorMock, redirectMock } = vi.hoisted(() => ({
    getTrustedActorMock: vi.fn(),
    redirectMock: vi.fn((path: string) => { throw new Error(`REDIRECT:${path}`); }),
}));

vi.mock('@/lib/auth/permissions', () => ({ getTrustedActorProfile: getTrustedActorMock }));
vi.mock('@/app/auth/actions', () => ({ logout: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: redirectMock, unstable_rethrow: vi.fn() }));
vi.mock('@/components/NavigationTop', () => ({
    NavigationTop: ({ role }: { role: string }) => <div data-testid="navigation">{role}</div>,
}));
vi.mock('@/features/onboarding/OnboardingWizard', () => ({
    OnboardingWizard: () => <div data-testid="onboarding">onboarding</div>,
}));
vi.mock('@/contexts/NotificationContext', () => ({
    NotificationProvider: ({ children }: { children: React.ReactNode }) => children,
}));

import DashboardLayout from '../layout';
import { PendingAccountView } from '@/features/auth/PendingAccountView';

describe('ZIN-SDD-041 dashboard authority gate', () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    it('renders the canonical actor role without an Agent fallback', async () => {
        getTrustedActorMock.mockResolvedValue({
            id: '11111111-1111-4111-8111-111111111111',
            role: 'franchise',
            parentId: '22222222-2222-4222-8222-222222222222',
            franchiseId: '33333333-3333-4333-8333-333333333333',
        });

        render(await DashboardLayout({ children: <div>datos operativos</div> }));

        expect(screen.getByTestId('navigation').textContent).toBe('franchise');
        expect(screen.getByTestId('onboarding')).toBeTruthy();
        expect(screen.getByText('datos operativos')).toBeTruthy();
    });

    it('redirects an invalid account before rendering tenant UI', async () => {
        getTrustedActorMock.mockRejectedValue(new Error('ACCOUNT_NOT_ACTIVE'));

        await expect(DashboardLayout({ children: <div>datos operativos</div> }))
            .rejects.toThrow('REDIRECT:/account-pending');

        expect(redirectMock).toHaveBeenCalledWith('/account-pending');
    });

    it('renders one safe pending surface with support and sign-out', () => {
        render(<PendingAccountView />);
        expect(screen.getByRole('heading', { name: /todavía no tiene acceso operativo/i })).toBeTruthy();
        expect(screen.getByRole('link', { name: /contactar con soporte/i }).getAttribute('href')).toContain('mailto:');
        expect(screen.getByRole('button', { name: /cerrar sesión/i })).toBeTruthy();
        expect(screen.queryByTestId('navigation')).toBeNull();
        expect(screen.queryByTestId('onboarding')).toBeNull();
        expect(screen.queryByText('datos operativos')).toBeNull();
    });
});
