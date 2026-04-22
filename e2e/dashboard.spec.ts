/**
 * Dashboard navigation E2E tests.
 *
 * Runs with the authenticated agent storage state.
 * Skips gracefully when credentials are not configured.
 */

import { test, expect } from '@playwright/test';
import { hasAgentCredentials } from './helpers/auth';

test.beforeEach(async ({ page }) => {
    if (!hasAgentCredentials()) {
        test.skip(true, 'Agent credentials not configured — skipping authenticated tests');
    }
    // Navigate to dashboard — storageState already provides auth
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/dashboard/, { timeout: 10_000 });
});

test.describe('Dashboard layout', () => {
    test('shows key navigation elements', async ({ page }) => {
        // Should have the main dashboard content rendered
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('navigates to Simulator page', async ({ page }) => {
        await page.goto('/dashboard/simulator');
        await expect(page).toHaveURL(/simulator/, { timeout: 10_000 });
        // The simulator upload area should be visible
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('navigates to Proposals page', async ({ page }) => {
        await page.goto('/dashboard/proposals');
        await expect(page).toHaveURL(/proposals/, { timeout: 10_000 });
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('navigates to Clients page', async ({ page }) => {
        await page.goto('/dashboard/clients');
        await expect(page).toHaveURL(/clients/, { timeout: 10_000 });
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });

    test('navigates to Network page', async ({ page }) => {
        await page.goto('/dashboard/network');
        await expect(page).toHaveURL(/network/, { timeout: 10_000 });
        await expect(page.locator('main, [role="main"]').first()).toBeVisible();
    });
});
