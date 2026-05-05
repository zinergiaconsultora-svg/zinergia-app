/**
 * Auth E2E tests
 *
 * Tests the login page with and without stored credentials.
 * These run WITHOUT pre-authenticated state so we can test the login form itself.
 */

import { test, expect } from '@playwright/test';

// Override: these tests start unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login page', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/');
    });

    test('renders the login form with email and password fields', async ({ page }) => {
        await expect(page.getByLabel(/email/i)).toBeVisible();
        await expect(page.getByLabel(/contraseña|password/i)).toBeVisible();
        await expect(page.getByRole('button', { name: /entrar|iniciar|sign in|login/i })).toBeVisible();
    });

    test('shows an error when credentials are empty', async ({ page }) => {
        await page.getByRole('button', { name: /entrar|iniciar|sign in|login/i }).click();
        // Either a browser validation tooltip or our own error message
        const emailField = page.getByLabel(/email/i);
        const isInvalid = await emailField.evaluate((el: HTMLInputElement) => !el.validity.valid);
        expect(isInvalid).toBe(true);
    });

    test('shows an error message for wrong credentials', async ({ page }) => {
        await page.getByLabel(/email/i).fill('nobody@nowhere.invalid');
        await page.getByLabel(/contraseña|password/i).fill('wrongpassword123');
        await page.getByRole('button', { name: /entrar|iniciar|sign in|login/i }).click();

        // Error alert should appear (our custom error state)
        await expect(page.locator('#login-error')).toBeVisible({ timeout: 15_000 });

        // Should NOT redirect away from the login screen
        await expect(page).toHaveURL(/\/(?:\?.*)?$/);
    });

    test('redirects unauthenticated user from /dashboard to /', async ({ page }) => {
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/\?redirect_to=%2Fdashboard$/, { timeout: 10_000 });
    });

    test('redirects unauthenticated user from /dashboard/simulator to /', async ({ page }) => {
        await page.goto('/dashboard/simulator');
        await expect(page).toHaveURL(/\/\?redirect_to=%2Fdashboard%2Fsimulator$/, { timeout: 10_000 });
    });
});

test.describe('Authenticated navigation', () => {
    test('logs in and lands on dashboard when credentials are valid', async ({ page }) => {
        const email = process.env.E2E_AGENT_EMAIL;
        const password = process.env.E2E_AGENT_PASSWORD;

        if (!email || !password) {
            test.skip(true, 'E2E_AGENT_EMAIL / E2E_AGENT_PASSWORD not configured');
        }

        await page.goto('/');
        await page.getByLabel(/email/i).fill(email!);
        await page.getByLabel(/contraseña|password/i).fill(password!);
        await page.getByRole('button', { name: /entrar|iniciar|sign in|login/i }).click();

        await expect(page).toHaveURL(/dashboard/, { timeout: 15_000 });
    });
});
