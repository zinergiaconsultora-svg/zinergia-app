/**
 * Global setup: authenticates two test users (agent + admin) and saves
 * the browser storage state so subsequent tests skip the login screen.
 *
 * Required env vars:
 *   E2E_AGENT_EMAIL / E2E_AGENT_PASSWORD
 *   E2E_ADMIN_EMAIL  / E2E_ADMIN_PASSWORD
 */

import { test as setup, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const AUTH_DIR = path.join(__dirname, '.auth');

setup.beforeAll(() => {
    if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
});

// ── Agent login ───────────────────────────────────────────────────────────────

setup('authenticate as agent', async ({ page }) => {
    const email = process.env.E2E_AGENT_EMAIL;
    const password = process.env.E2E_AGENT_PASSWORD;

    if (!email || !password) {
        console.warn(
            '[E2E setup] E2E_AGENT_EMAIL / E2E_AGENT_PASSWORD not set — ' +
            'writing empty agent auth state. Agent tests will skip.',
        );
        fs.writeFileSync(path.join(AUTH_DIR, 'agent.json'), JSON.stringify({ cookies: [], origins: [] }));
        return;
    }

    await page.goto('/');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole('button', { name: /entrar|iniciar|sign in|login/i }).click();

    // Wait for redirect to /dashboard
    await page.waitForURL('**/dashboard**', { timeout: 15_000 });
    await expect(page).toHaveURL(/dashboard/);

    await page.context().storageState({ path: path.join(AUTH_DIR, 'agent.json') });
});

// ── Admin login ───────────────────────────────────────────────────────────────

setup('authenticate as admin', async ({ page }) => {
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;

    if (!email || !password) {
        console.warn(
            '[E2E setup] E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set — ' +
            'writing empty admin auth state. Admin tests will skip.',
        );
        fs.writeFileSync(path.join(AUTH_DIR, 'admin.json'), JSON.stringify({ cookies: [], origins: [] }));
        return;
    }

    await page.goto('/');
    await page.getByLabel(/email/i).fill(email);
    await page.getByLabel(/contraseña|password/i).fill(password);
    await page.getByRole('button', { name: /entrar|iniciar|sign in|login/i }).click();

    // Admin gets redirected to /admin
    await page.waitForURL('**/admin**', { timeout: 15_000 });
    await expect(page).toHaveURL(/admin/);

    await page.context().storageState({ path: path.join(AUTH_DIR, 'admin.json') });
});
