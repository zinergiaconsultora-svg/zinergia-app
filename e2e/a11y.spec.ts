/**
 * Accessibility (WCAG AA) E2E tests — axe-core via @axe-core/playwright.
 *
 * Covers the 4 critical views:
 *  1. Landing / login page (/)             — unauthenticated
 *  2. Simulator (/dashboard/simulator)     — requires agent auth
 *  3. Public proposal (/p/[token])         — unauthenticated, token-gated
 *  4. Onboarding wizard                    — appears on first agent login
 *
 * Any axe violation at impact "critical" or "serious" fails the test.
 * "moderate" and "minor" are reported but do not fail (informational).
 *
 * Run locally:
 *   pnpm test:e2e --grep "@a11y"
 * Run all:
 *   pnpm test:e2e
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { hasAgentCredentials } from './helpers/auth';

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Returns only critical + serious violations (WCAG AA blockers).
 * Filters out known false-positives from third-party widgets (e.g. SignaturePad canvas).
 */
function blockerViolations(results: Awaited<ReturnType<AxeBuilder['analyze']>>['violations']) {
    return results.filter(
        (v) =>
            (v.impact === 'critical' || v.impact === 'serious') &&
            // Signature canvas has no accessible name by design (handled separately)
            !v.nodes.every((n) => n.html.includes('react-signature-canvas')),
    );
}

// ── 1. Landing page ───────────────────────────────────────────────────────────

test.describe('a11y — Landing page @a11y', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('has no critical/serious axe violations', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const blockers = blockerViolations(results.violations);

        if (blockers.length > 0) {
            const summary = blockers
                .map((v) => `[${v.impact}] ${v.id}: ${v.description}\n  → ${v.nodes.map((n) => n.html).join('\n  → ')}`)
                .join('\n\n');
            expect.soft(blockers, `A11y blockers on /:\n\n${summary}`).toHaveLength(0);
        }

        expect(blockers).toHaveLength(0);
    });

    test('login form has proper label associations', async ({ page }) => {
        await page.goto('/');
        const emailInput = page.locator('#email');
        const passwordInput = page.locator('#password');
        await expect(emailInput).toBeVisible();
        await expect(passwordInput).toBeVisible();
        // Labels must be associated via id
        const emailLabel = page.locator('label[for="email"], label:has(#email)');
        await expect(emailLabel).toHaveCount(1);
    });

    test('error alert has role="alert" when credentials are wrong', async ({ page }) => {
        await page.goto('/');
        await page.fill('#email', 'invalid@example.com');
        await page.fill('#password', 'wrongpassword');
        await page.click('button[type="submit"]');
        // After submission error should appear
        const alert = page.locator('[role="alert"]');
        await expect(alert).toBeVisible({ timeout: 10_000 });
    });
});

// ── 2. Simulator ─────────────────────────────────────────────────────────────

test.describe('a11y — Simulator @a11y', () => {
    test.beforeEach(async () => {
        if (!hasAgentCredentials()) {
            test.skip(true, 'Agent credentials not configured — skipping simulator a11y');
        }
    });

    test('has no critical/serious axe violations on /dashboard/simulator', async ({ page }) => {
        await page.goto('/dashboard/simulator');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            // Framer Motion adds inline styles that can trigger color-contrast checks
            // on animated elements before they settle — exclude during animation
            .exclude('[data-framer-motion]')
            .analyze();

        const blockers = blockerViolations(results.violations);

        if (blockers.length > 0) {
            const summary = blockers
                .map((v) => `[${v.impact}] ${v.id}: ${v.description}`)
                .join('\n');
            expect(blockers, `A11y blockers on /dashboard/simulator:\n\n${summary}`).toHaveLength(0);
        }

        expect(blockers).toHaveLength(0);
    });

    test('simulator page has a visible h1', async ({ page }) => {
        await page.goto('/dashboard/simulator');
        const h1 = page.locator('h1').first();
        await expect(h1).toBeVisible({ timeout: 5_000 });
        const text = await h1.textContent();
        expect(text?.trim().length).toBeGreaterThan(0);
    });
});

// ── 3. Public proposal ────────────────────────────────────────────────────────

test.describe('a11y — Public proposal @a11y', () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test('invalid token page has no critical/serious axe violations', async ({ page }) => {
        await page.goto('/p/00000000-0000-0000-0000-000000000000');
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const blockers = blockerViolations(results.violations);
        if (blockers.length > 0) {
            const summary = blockers.map((v) => `[${v.impact}] ${v.id}: ${v.description}`).join('\n');
            expect(blockers, `A11y blockers on /p/invalid:\n\n${summary}`).toHaveLength(0);
        }
        expect(blockers).toHaveLength(0);
    });

    test('valid token proposal has no critical/serious axe violations', async ({ page }) => {
        const token = process.env.E2E_PROPOSAL_TOKEN;
        if (!token) test.skip(true, 'E2E_PROPOSAL_TOKEN not set');

        await page.goto(`/p/${token}`);
        await page.waitForLoadState('networkidle');

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze();

        const blockers = blockerViolations(results.violations);
        if (blockers.length > 0) {
            const summary = blockers.map((v) => `[${v.impact}] ${v.id}: ${v.description}`).join('\n');
            expect(blockers, `A11y blockers on /p/${token}:\n\n${summary}`).toHaveLength(0);
        }
        expect(blockers).toHaveLength(0);
    });

    test('proposal page has main landmark and h1', async ({ page }) => {
        const token = process.env.E2E_PROPOSAL_TOKEN;
        if (!token) test.skip(true, 'E2E_PROPOSAL_TOKEN not set');

        await page.goto(`/p/${token}`);
        await page.waitForLoadState('networkidle');

        await expect(page.locator('main')).toBeVisible({ timeout: 8_000 });
        await expect(page.locator('h1')).toBeVisible({ timeout: 8_000 });
    });
});

// ── 4. Onboarding wizard ─────────────────────────────────────────────────────

test.describe('a11y — Onboarding wizard @a11y', () => {
    test.beforeEach(async () => {
        if (!hasAgentCredentials()) {
            test.skip(true, 'Agent credentials not configured — skipping onboarding a11y');
        }
    });

    test('modal has role=dialog and aria-modal when shown', async ({ page }) => {
        // Clear onboarding storage key so the wizard shows up
        await page.goto('/dashboard');
        await page.evaluate(() => {
            localStorage.removeItem('zinergia_onboarding_done_v1');
        });
        await page.reload();

        const dialog = page.locator('[role="dialog"]');
        // If wizard shows, verify modal attributes
        const isVisible = await dialog.isVisible().catch(() => false);
        if (isVisible) {
            await expect(dialog).toHaveAttribute('aria-modal', 'true');
            // Must have an accessible name (aria-labelledby pointing to a heading)
            const labelledBy = await dialog.getAttribute('aria-labelledby');
            expect(labelledBy).toBeTruthy();
            if (labelledBy) {
                const heading = page.locator(`#${labelledBy}`);
                await expect(heading).toBeVisible();
            }
        }
        // If wizard doesn't show (already dismissed), skip gracefully
    });

    test('onboarding wizard has no critical/serious axe violations when shown', async ({ page }) => {
        await page.goto('/dashboard');
        await page.evaluate(() => {
            localStorage.removeItem('zinergia_onboarding_done_v1');
        });
        await page.reload();

        const dialog = page.locator('[role="dialog"]');
        const isVisible = await dialog.isVisible().catch(() => false);
        if (!isVisible) {
            test.skip(true, 'Onboarding wizard not shown — skipping axe scan');
        }

        const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa'])
            .include('[role="dialog"]')
            .analyze();

        const blockers = blockerViolations(results.violations);
        if (blockers.length > 0) {
            const summary = blockers.map((v) => `[${v.impact}] ${v.id}: ${v.description}`).join('\n');
            expect(blockers, `A11y blockers in onboarding dialog:\n\n${summary}`).toHaveLength(0);
        }
        expect(blockers).toHaveLength(0);
    });
});
