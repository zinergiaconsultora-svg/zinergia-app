/**
 * Admin panel E2E tests.
 *
 * Runs with admin storage state (chromium-admin project).
 * Verifies: dashboard, audit log, KPIs, RGPD panel, agent management.
 */

import { test, expect } from '@playwright/test';

const hasAdminCredentials = () =>
    !!(process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD);

test.beforeEach(async () => {
    if (!hasAdminCredentials()) {
        test.skip(true, 'Admin credentials not configured — skipping admin tests');
    }
});

test.describe('Admin panel navigation', () => {
    test('redirects to /admin for admin users', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/admin/, { timeout: 10_000 });
    });

    test('renders admin dashboard with nav links', async ({ page }) => {
        await page.goto('/admin');
        await expect(page.getByRole('link', { name: /reporting/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /agentes/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /audit/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /kpis/i })).toBeVisible();
    });

    test('Audit log page loads and shows filter buttons', async ({ page }) => {
        await page.goto('/admin/audit');
        await expect(page).toHaveURL(/audit/);
        // Filter buttons should render (at minimum "Todas")
        await expect(page.getByRole('button', { name: /todas/i })).toBeVisible({ timeout: 10_000 });
    });

    test('Business KPIs page loads and shows funnel section', async ({ page }) => {
        await page.goto('/admin/business-metrics');
        await expect(page).toHaveURL(/business-metrics/);
        // The funnel section heading
        await expect(
            page.getByText(/embudo de conversión|últimos 30 días/i)
        ).toBeVisible({ timeout: 10_000 });
    });

    test('RGPD panel loads', async ({ page }) => {
        await page.goto('/admin/rgpd');
        await expect(page).toHaveURL(/rgpd/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('Agents page loads', async ({ page }) => {
        await page.goto('/admin/agents');
        await expect(page).toHaveURL(/agents/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('Reporting page loads', async ({ page }) => {
        await page.goto('/admin/reporting');
        await expect(page).toHaveURL(/reporting/);
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});

test.describe('Admin access control', () => {
    test('non-admin users cannot access /admin (redirect)', async ({ page }) => {
        // Force unauthenticated state
        await page.context().clearCookies();
        await page.goto('/admin');
        // Should redirect to login
        await expect(page).toHaveURL('/', { timeout: 10_000 });
    });
});
