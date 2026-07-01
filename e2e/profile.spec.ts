/**
 * Agent settings/profile E2E tests.
 *
 * Covers: settings page rendering, profile tab, save action.
 * Runs with authenticated agent storage state.
 */

import { test, expect } from '@playwright/test';
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

    test('shows profile form with name and email fields', async ({ page }) => {
        await page.goto('/dashboard/settings');

        const nameField = page
            .getByLabel(/nombre|name/i)
            .or(page.locator('input[name="name"]'))
            .or(page.locator('input[name="full_name"]'));

        const emailField = page
            .getByLabel(/email|correo/i)
            .or(page.locator('input[name="email"]'))
            .or(page.locator('input[type="email"]'));

        // At least name or email should be visible
        const hasName = await nameField.first().isVisible().catch(() => false);
        const hasEmail = await emailField.first().isVisible().catch(() => false);
        expect(hasName || hasEmail).toBe(true);
    });

    test('has a save/update button', async ({ page }) => {
        await page.goto('/dashboard/settings');

        const saveBtn = page
            .getByRole('button', { name: /guardar|actualizar|save|update/i });

        await expect(saveBtn.first()).toBeVisible({ timeout: 10_000 });
    });
});
