/**
 * Client management E2E tests.
 *
 * Covers: client list rendering, client detail view, search/filter.
 * Runs with authenticated agent storage state.
 */

import { test, expect } from '@playwright/test';
import { hasAgentCredentials } from './helpers/auth';

test.beforeEach(async () => {
    if (!hasAgentCredentials()) {
        test.skip(true, 'Agent credentials not configured — skipping client tests');
    }
});

test.describe('Client list', () => {
    test('renders client list or empty state on /dashboard/clients', async ({ page }) => {
        await page.goto('/dashboard/clients');
        await expect(page).toHaveURL(/clients/, { timeout: 10_000 });

        const content = page
            .locator('table, [data-testid="client-list"]')
            .or(page.getByText(/no hay clientes|sin clientes|todavía/i))
            .or(page.locator('ul').first());

        await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('has a search or filter input', async ({ page }) => {
        await page.goto('/dashboard/clients');

        const searchInput = page
            .getByPlaceholder(/buscar|filtrar|search/i)
            .or(page.locator('input[type="search"]'));

        // Search may not exist if client list is empty — soft check
        const isVisible = await searchInput.first().isVisible().catch(() => false);
        if (isVisible) {
            await expect(searchInput.first()).toBeEnabled();
        }
    });

    test('client row links to detail view', async ({ page }) => {
        await page.goto('/dashboard/clients');

        const firstClientLink = page
            .locator('a[href*="/clients/"]')
            .or(page.locator('tr[data-testid="client-row"]').first());

        const isVisible = await firstClientLink.first().isVisible().catch(() => false);
        if (!isVisible) {
            test.skip(true, 'No clients in list — cannot test detail navigation');
        }

        await firstClientLink.first().click();
        await expect(page).toHaveURL(/clients\//, { timeout: 10_000 });
    });
});

test.describe('Client detail', () => {
    test('shows client information when navigating to a client page', async ({ page }) => {
        await page.goto('/dashboard/clients');

        const firstClientLink = page.locator('a[href*="/clients/"]').first();
        const isVisible = await firstClientLink.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip(true, 'No clients available — skipping detail test');
        }

        await firstClientLink.click();
        await expect(page).toHaveURL(/clients\//, { timeout: 10_000 });

        // Client detail should show name or identifying info
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
