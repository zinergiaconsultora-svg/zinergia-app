/**
 * Agent settings/profile E2E tests.
 *
 * Covers: settings page rendering, profile tab, save action.
 * Runs with authenticated agent storage state.
 */

import { test, expect } from './fixtures/runtime';
import { hasAgentCredentials } from './helpers/auth';

test.beforeEach(async () => {
    if (!hasAgentCredentials()) {
        test.skip(true, 'Agent credentials not configured — skipping profile tests');
    }
});

test.describe('Profile page', () => {
    test('renders settings page at /dashboard/settings', async ({ page }) => {
        await page.goto('/dashboard/settings');
        await expect(page).toHaveURL(/settings/, { timeout: 10_000 });
        await expect(page.locator('main').first()).toBeVisible();
        await expect(page.getByRole('heading', { name: /configuración/i })).toBeVisible();
    });

    test('shows the editable company profile field', async ({ page }) => {
        await page.goto('/dashboard/settings');

        const profileField = page.getByRole('textbox', {
            name: /razón social|nombre comercial/i,
        });

        await expect(profileField).toBeVisible({ timeout: 10_000 });
    });

    test('has a save/update button', async ({ page }) => {
        await page.goto('/dashboard/settings');

        const saveBtn = page
            .getByRole('button', { name: /guardar|actualizar|save|update/i });

        await expect(saveBtn.first()).toBeVisible({ timeout: 10_000 });
    });
});
