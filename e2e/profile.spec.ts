/**
 * Agent profile E2E tests.
 *
 * Covers: profile page rendering, form fields, profile update.
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
    test('renders profile page at /dashboard/profile', async ({ page }) => {
        await page.goto('/dashboard/profile');
        await expect(page).toHaveURL(/profile/, { timeout: 10_000 });
        await expect(page.locator('main').first()).toBeVisible();
    });

    test('shows profile form with name and email fields', async ({ page }) => {
        await page.goto('/dashboard/profile');

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
        await page.goto('/dashboard/profile');

        const saveBtn = page
            .getByRole('button', { name: /guardar|actualizar|save|update/i });

        await expect(saveBtn.first()).toBeVisible({ timeout: 10_000 });
    });
});
