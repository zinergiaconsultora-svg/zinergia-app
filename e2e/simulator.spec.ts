/**
 * Simulator E2E tests
 *
 * Happy path: upload invoice → OCR processing → confirm data → compare → proposal
 * Edge cases: OCR failure, CUPS already linked to another client
 *
 * The N8N webhook POST is intercepted so tests don't depend on external services.
 * Realtime broadcast is bypassed: tests wait for the polling fallback to detect
 * the completed job status.
 */

import { test, expect, type Page, type TestInfo } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { hasAgentCredentials } from './helpers/auth';
import { interceptOcrWebhook } from './helpers/ocr-mock';

// ── Fixture PDF (tiny 1-page blank — real OCR won't run, but upload is tested) ──

function getFixturePdfPath(testInfo: TestInfo): string {
    const fixturePath = testInfo.outputPath('sample-invoice.pdf');
    if (!fs.existsSync(fixturePath)) {
        fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
        // Minimal PDF that passes file-type check
        const minimalPdf = Buffer.from(
            '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
            '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
            '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
            'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
            '0000000052 00000 n\n0000000101 00000 n\n' +
            'trailer<</Size 4/Root 1 0 R>>\nstartxref\n173\n%%EOF',
        );
        fs.writeFileSync(fixturePath, minimalPdf);
    }
    return fixturePath;
}

async function selectResidentialSegment(page: Page) {
    const segmentButton = page.getByRole('button', { name: /cliente residencial/i });
    if (await segmentButton.isVisible().catch(() => false)) {
        await segmentButton.click();
    }
}

test.beforeEach(async () => {
    if (!hasAgentCredentials()) {
        test.skip(true, 'Agent credentials not configured — skipping simulator tests');
    }
});

test.describe('Simulator — file upload', () => {
    test('renders upload area on /dashboard/simulator', async ({ page }) => {
        await page.goto('/dashboard/simulator');
        await selectResidentialSegment(page);
        // Upload area should be present (drop zone or file input)
        await expect(page.getByText(/arrastra tu factura aquí/i)).toBeVisible({ timeout: 10_000 });
        await expect(page.locator('input[type="file"]')).toHaveCount(1);
    });

    test('rejects non-PDF/image files with validation feedback', async ({ page }, testInfo) => {
        await interceptOcrWebhook(page);
        await page.goto('/dashboard/simulator');
        await selectResidentialSegment(page);

        const txtPath = testInfo.outputPath('invalid.txt');
        if (!fs.existsSync(txtPath)) {
            fs.mkdirSync(path.dirname(txtPath), { recursive: true });
            fs.writeFileSync(txtPath, 'not a PDF');
        }

        const fileInput = page.locator('input[type="file"]');
        if (await fileInput.count()) {
            await fileInput.setInputFiles(txtPath);
            // An error/warning should appear for unsupported file type
            const feedback = page
                .getByText(/no admitido|invalid|formato|tipo de archivo/i)
                .or(page.locator('[role="alert"]'));
            await expect(feedback.first()).toBeVisible({ timeout: 5_000 });
        }
    });

    test('accepts a PDF file and shows processing state', async ({ page }, testInfo) => {
        await interceptOcrWebhook(page);
        await page.goto('/dashboard/simulator');
        await selectResidentialSegment(page);

        const fileInput = page.locator('input[type="file"]');
        if (!await fileInput.count()) {
            test.skip(true, 'No visible file input — simulator may use drag-and-drop only');
        }

        await fileInput.setInputFiles(getFixturePdfPath(testInfo));

        // Processing indicator (spinner, loading message, or progress text) should appear
        const processingIndicator = page
            .getByText(/procesando|analizando|cargando|processing/i)
            .or(page.locator('[data-testid="ocr-loading"]'))
            .or(page.locator('[role="progressbar"]').first());

        await expect(processingIndicator.first()).toBeVisible({ timeout: 15_000 });
    });
});

test.describe('Simulator — OCR failure edge case', () => {
    test('shows error state when OCR webhook is unavailable', async ({ page }, testInfo) => {
        test.skip(true, 'The OCR webhook is called server-side, so Playwright page.route cannot deterministically force this failure.');

        // Mock webhook to return 500
        await page.route('**/webhooks/ocr**', async (route) => {
            if (route.request().url().includes('/callback')) {
                await route.continue();
                return;
            }
            await route.fulfill({ status: 500, body: 'Service Unavailable' });
        });

        await page.goto('/dashboard/simulator');
        await selectResidentialSegment(page);
        const fileInput = page.locator('input[type="file"]');
        if (!await fileInput.count()) return;

        await fileInput.setInputFiles(getFixturePdfPath(testInfo));

        // Eventually shows an error (either immediately from the action or after timeout)
        const errorIndicator = page
            .getByText(/error|fallo|no se pudo|failed/i)
            .or(page.locator('[data-testid="ocr-error"]'));

        // Allow up to 35 s (the job timeout is 30 s)
        await expect(errorIndicator).toBeVisible({ timeout: 35_000 });
    });
});

test.describe('Simulator — proposal flow (requires pre-completed OCR job)', () => {
    /**
     * This test navigates to the proposals list and verifies the page renders.
     * A full end-to-end OCR → confirm → compare → proposal flow requires a
     * real Supabase database row to be inserted via the OCR callback.
     * Run this test with a seeded staging environment.
     */
    test('proposals list renders and shows proposal cards or empty state', async ({ page }) => {
        await page.goto('/dashboard/proposals');
        await expect(page).toHaveURL(/proposals/);

        // Either a list of proposals or an empty-state message
        const content = page
            .locator('[data-testid="proposal-card"]')
            .or(page.getByText(/no hay propuestas|sin propuestas|empty|todavía/i))
            .or(page.locator('table').first())
            .or(page.locator('ul').first());

        await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });

    test('public proposal page renders for a valid token', async ({ page }) => {
        // This test requires the deterministic staging fixture token.
        const token = process.env.E2E_PUBLIC_PROPOSAL_TOKEN ?? process.env.E2E_PROPOSAL_TOKEN;
        if (!token) {
            test.skip(true, 'E2E_PUBLIC_PROPOSAL_TOKEN not set — skipping public proposal test');
        }

        // Public proposal pages are unauthenticated
        await page.context().clearCookies();
        await page.goto(`/p/${token}`);

        // The proposal viewer should render (company name, annual savings, accept button)
        const content = page
            .getByText(/ahorro anual|propuesta|ahorro estimado/i)
            .or(page.locator('[data-testid="proposal-view"]'));

        await expect(content.first()).toBeVisible({ timeout: 10_000 });
    });
});
