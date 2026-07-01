/**
 * Dashboard navigation E2E tests.
 *
 * Runs with the authenticated agent storage state.
 * Skips gracefully when credentials are not configured.
 */

import { type Page } from '@playwright/test';
import { test, expect } from './fixtures/runtime';
import { hasAgentCredentials } from './helpers/auth';

const commercialNav = [
    'Inicio',
    'Clientes',
    'Facturas',
    'Propuestas',
    'Simulador',
    'Cartera',
    'Ajustes',
    'Tarifas',
];

const commercialRoutes = [
    { path: '/dashboard/clients', url: /clients/, signal: /Clientes|Buscar por nombre/i },
    { path: '/dashboard/invoices', url: /invoices/, signal: /Facturas de clientes|No hay facturas/i },
    { path: '/dashboard/proposals', url: /proposals/, signal: /Propuestas|Nueva simulación|Buscar cliente/i },
    { path: '/dashboard/simulator', url: /simulator/, signal: /Simulador de Facturas|Comparar varias|Guía de uso/i },
    { path: '/dashboard/wallet', url: /wallet/, signal: /Mi Cartera|Saldo Disponible|Wallet Activa/i },
    { path: '/dashboard/settings', url: /settings/, signal: /Configuración|Gestión de perfil/i },
    { path: '/dashboard/tariffs', url: /tariffs/, signal: /Tarifas disponibles|Gestión de Tarifas|Buscar/i },
];

async function gotoRoute(page: Page, path: string) {
    try {
        await page.goto(path, { waitUntil: 'commit', timeout: 30_000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('ERR_ABORTED')) {
            throw error;
        }
        await page.goto(path, { waitUntil: 'commit', timeout: 30_000 });
        await page.waitForLoadState('domcontentloaded', { timeout: 15_000 }).catch(() => {});
    }
}

test.beforeEach(async ({ page }) => {
    if (!hasAgentCredentials()) {
        test.skip(true, 'Agent credentials not configured — skipping authenticated tests');
    }
    // Navigate to dashboard — storageState already provides auth
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
});

test.describe('Dashboard layout', () => {
    test('shows commercial dashboard content and navigation', async ({ page }) => {
        await expect(page.getByRole('heading', { name: /Ahorro Encontrado/i })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('heading', { name: /Estado de Propuestas/i })).toBeVisible();

        for (const label of commercialNav) {
            await expect(page.getByRole('link', { name: label, exact: true })).toBeVisible();
        }

        await expect(page.getByRole('link', { name: /Admin Panel/i })).toHaveCount(0);
    });

    for (const route of commercialRoutes) {
        test(`renders ${route.path} with route-specific content`, async ({ page }) => {
            await gotoRoute(page, route.path);
            await expect(page).toHaveURL(route.url, { timeout: 10_000 });
            await expect(page.locator('main').getByText(route.signal).first()).toBeVisible({ timeout: 15_000 });
        });
    }

    test('commercial users cannot open admin content', async ({ page }) => {
        await gotoRoute(page, '/admin');
        await expect(page).not.toHaveURL(/\/admin$/, { timeout: 10_000 });
        await expect(page.getByText(/Vista Global del Sistema|Cola de Conversión/i)).toHaveCount(0);
    });
});
