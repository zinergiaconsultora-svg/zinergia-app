/**
 * Auth helpers for E2E tests.
 * Provides a `loginAs()` helper that can be called directly when storage state
 * is not available (e.g. the unauthenticated-redirect tests).
 */

import type { Page } from '@playwright/test';

export async function loginAs(
    page: Page,
    email: string,
    password: string,
    expectedUrlPattern: RegExp = /dashboard/,
): Promise<void> {
    await page.goto('/');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole('button', { name: /entrar|iniciar|sign in|login/i }).click();
    await page.waitForURL(expectedUrlPattern, { timeout: 15_000 });
}

export async function logout(page: Page): Promise<void> {
    // Logout via the button that submits the logout form
    const logoutBtn = page.getByRole('button', { name: /cerrar sesión|logout/i });
    if (await logoutBtn.isVisible()) {
        await logoutBtn.click();
        await page.waitForURL('/', { timeout: 10_000 });
    }
}

/** Returns true when the current test has real credentials available */
export function hasAgentCredentials(): boolean {
    return !!(process.env.E2E_AGENT_EMAIL && process.env.E2E_AGENT_PASSWORD);
}
