/**
 * Public proposal page E2E tests.
 *
 * These tests run WITHOUT auth (unauthenticated) because the public proposal
 * view (/p/[token]) is accessible to clients without an account.
 *
 * Edge cases covered:
 *  - Invalid/expired token → 404 or error state
 *  - Valid proposal renders accept button + savings data
 */

import { test, expect } from '@playwright/test';

// Override: public proposal page is unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Public proposal — invalid token', () => {
    test('returns 404 or error page for an invalid token', async ({ page }) => {
        const response = await page.goto('/p/00000000-0000-0000-0000-000000000000');
        // Either HTTP 404 or an in-page "not found" message
        const is404 = response?.status() === 404;
        const hasNotFoundText = await page
            .getByText(/no encontrada|not found|expirada|inválida|no existe/i)
            .isVisible()
            .catch(() => false);

        expect(is404 || hasNotFoundText).toBe(true);
    });
});

test.describe('Public proposal — valid token (requires E2E_PROPOSAL_TOKEN)', () => {
    test.beforeEach(async () => {
        if (!process.env.E2E_PROPOSAL_TOKEN) {
            test.skip(true, 'E2E_PROPOSAL_TOKEN not set');
        }
    });

    test('renders proposal summary with annual savings', async ({ page }) => {
        await page.goto(`/p/${process.env.E2E_PROPOSAL_TOKEN}`);
        await expect(
            page.getByText(/ahorro anual|ahorro estimado/i)
        ).toBeVisible({ timeout: 10_000 });
    });

    test('shows an accept / firma button', async ({ page }) => {
        await page.goto(`/p/${process.env.E2E_PROPOSAL_TOKEN}`);
        const acceptBtn = page.getByRole('button', { name: /aceptar|firmar|contratar/i });
        await expect(acceptBtn).toBeVisible({ timeout: 10_000 });
    });

    test('accept button triggers signature flow', async ({ page }) => {
        await page.goto(`/p/${process.env.E2E_PROPOSAL_TOKEN}`);
        const acceptBtn = page.getByRole('button', { name: /aceptar|firmar|contratar/i });
        await acceptBtn.click();

        // The signature canvas or confirmation modal should appear
        const signatureArea = page
            .locator('canvas')
            .or(page.getByText(/firma|signature|confirmación/i));
        await expect(signatureArea.first()).toBeVisible({ timeout: 10_000 });
    });
});
