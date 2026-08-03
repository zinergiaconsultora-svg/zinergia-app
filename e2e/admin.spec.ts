/**
 * Admin panel E2E tests.
 *
 * Runs with admin storage state (chromium-admin project).
 * Verifies: dashboard, audit log, KPIs, RGPD panel, agent management.
 */

import { test, expect } from './fixtures/runtime';

const hasAdminCredentials = () =>
    !!(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);

const adminNav = [
    /Hoy/i,
    /Oportunidades/i,
    /Clientes/i,
    /Comisiones/i,
    /Facturación/i,
    /Equipo/i,
    /Informes/i,
    /Procesamiento de facturas/i,
    /Historial de actividad/i,
];

const adminRoutes = [
    { path: '/admin/leads', url: /leads/, signal: /Leads|Colas de trabajo|Buscar titular/i },
    { path: '/admin/drive', url: /drive/, signal: /Panel de salud de Drive|Archivado de facturas/i },
    { path: '/admin/reporting', url: /reporting/, signal: /Informes|Resumen|Tendencias/i },
    { path: '/admin/agents', url: /agents/, signal: /Equipo y red|Buscar por nombre o email/i },
    { path: '/admin/academy', url: /academy/, signal: /Recursos Academy|Manual de Bienvenida/i },
    { path: '/admin/rgpd', url: /rgpd/, signal: /RGPD|clientes próximos|eliminaciones/i },
    { path: '/admin/audit', url: /audit/, signal: /Historial de actividad|Tipo de actividad/i },
    { path: '/admin/business-metrics', url: /business-metrics/, signal: /Informes|Resumen/i },
];

test.beforeEach(async ({}, testInfo) => {
    if (testInfo.project.name !== 'chromium-admin') {
        test.skip(true, 'Admin tests run only in the chromium-admin project');
    }

    if (!hasAdminCredentials()) {
        test.skip(true, 'Admin credentials not configured — skipping admin tests');
    }
});

test.describe('Admin panel navigation', () => {
    test('redirects to /admin for admin users', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/admin/, { timeout: 10_000 });
        await expect(page.getByRole('heading', { name: /Hoy/i })).toBeVisible({ timeout: 15_000 });
    });

    test('renders admin dashboard with nav links', async ({ page }) => {
        await page.goto('/admin');
        await expect(page.getByRole('heading', { name: /Hoy/i })).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('heading', { name: /Preparar propuestas/i })).toBeVisible();
        await expect(page.getByRole('heading', { name: /Tramitar altas/i })).toBeVisible();

        const adminHeaderNav = page.locator('aside nav');
        for (const label of adminNav) {
            await expect(adminHeaderNav.getByRole('link', { name: label })).toBeVisible();
        }
    });

    for (const route of adminRoutes) {
        test(`renders ${route.path} with route-specific content`, async ({ page }) => {
            await page.goto(route.path);
            await expect(page).toHaveURL(route.url, { timeout: 10_000 });
            await expect(page.getByText(route.signal).first()).toBeVisible({ timeout: 15_000 });
        });
    }
});

test.describe('Admin access control', () => {
    test('non-admin users cannot access /admin (redirect)', async ({ page }) => {
        // Force unauthenticated state
        await page.context().clearCookies();
        await page.goto('/admin');
        // Should redirect to login
        await expect(page).toHaveURL(/\/(\?redirect_to=%2Fadmin)?$/, { timeout: 10_000 });
        await expect(page.getByText(/Preparar propuestas|Tramitar altas/i)).toHaveCount(0);
    });
});
