/**
 * Public proposal page E2E tests.
 *
 * These tests run WITHOUT auth (unauthenticated) because the public proposal
 * view (/p/[token]) is accessible to clients without an account.
 *
 * Edge cases covered:
 *  - Invalid/expired token → 404 or error state
 *  - Valid staging fixture proposal renders accept button + savings data
 */

import { test, expect } from './fixtures/runtime';

const STAGING_PROJECT_REF = 'dnzytocmtmnptndeczny';
const STAGING_FIXTURE_TOKEN_PREFIX = 'e2e-';

// Override: public proposal page is unauthenticated
test.use({ storageState: { cookies: [], origins: [] } });

function publicProposalToken(): string | undefined {
    return process.env.E2E_PUBLIC_PROPOSAL_TOKEN ?? process.env.E2E_PROPOSAL_TOKEN;
}

function isStagingRun(): boolean {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? '';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
    if (/zinergia(?:-app)?\.vercel\.app|www\.zinergia\.es/.test(baseUrl)) return false;
    return baseUrl.includes('localhost') || supabaseUrl.includes(STAGING_PROJECT_REF);
}

function canUsePublicFixtureToken(): boolean {
    const token = publicProposalToken();
    if (!token) return false;
    if (!token.startsWith(STAGING_FIXTURE_TOKEN_PREFIX)) return true;
    return isStagingRun();
}

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
        await expect(page.getByRole('button', { name: /aceptar|firmar|contratar/i })).toHaveCount(0);
    });
});

test.describe('Public proposal — valid staging fixture token', () => {
    test.beforeEach(async () => {
        if (!publicProposalToken()) {
            test.skip(true, 'E2E_PUBLIC_PROPOSAL_TOKEN not set. Run npm run test:e2e:seed-public-proposal against staging.');
        }
        if (!canUsePublicFixtureToken()) {
            test.skip(true, 'Staging fixture proposal tokens are not used against production.');
        }
    });

    test('renders proposal summary with annual savings', async ({ page }) => {
        await page.goto(`/p/${publicProposalToken()}`);
        await expect(
            page.getByText(/de ahorro al año|ahorro estimado/i)
        ).toBeVisible({ timeout: 10_000 });
    });

    test('shows an accept / firma button', async ({ page }) => {
        await page.goto(`/p/${publicProposalToken()}`);
        const acceptBtn = page.getByRole('button', { name: /aceptar|firmar|contratar/i });
        await expect(acceptBtn).toBeVisible({ timeout: 10_000 });
    });

    test('accept button opens signature flow without confirming acceptance', async ({ page }) => {
        await page.goto(`/p/${publicProposalToken()}`);
        const acceptBtn = page.getByRole('button', { name: /aceptar|firmar|contratar/i });
        await acceptBtn.click();

        // Stop at the signature step. Do not click "Confirmar firma" in the read-only smoke path.
        const signatureArea = page
            .locator('canvas')
            .or(page.getByText(/firma|signature|confirmación/i));
        await expect(signatureArea.first()).toBeVisible({ timeout: 10_000 });
        await expect(page.getByRole('button', { name: /confirmar firma/i })).toBeDisabled();
    });
});
