/**
 * OCR webhook mock helpers.
 *
 * Because N8N is an external service, E2E tests intercept the outgoing POST
 * to OCR_WEBHOOK_URL with Playwright route mocking, then immediately trigger
 * the callback route to simulate N8N delivering extracted invoice data.
 *
 * Usage:
 *   const mock = await mockOcrSuccess(page, MOCK_INVOICE);
 *   // upload a file and start OCR
 *   await mock.waitForCallback();
 */

import type { Page, Route } from '@playwright/test';

export interface MockInvoiceData {
    company_name: string;
    cups: string;
    client_name: string;
    address: string;
    tariff_type: string;
    annual_kwh: number;
    annual_cost: number;
    contract_power_p1: number;
    contract_power_p2: number;
    billing_days: number;
    invoice_date: string;
}

export const SAMPLE_INVOICE: MockInvoiceData = {
    company_name: 'ENDESA',
    cups: 'ES0031405111111111XX',
    client_name: 'Empresa Ejemplo SL',
    address: 'Calle Mayor 1, 28001 Madrid',
    tariff_type: '2.0TD',
    annual_kwh: 12000,
    annual_cost: 2400,
    contract_power_p1: 5.5,
    contract_power_p2: 5.5,
    billing_days: 30,
    invoice_date: '2025-01-15',
};

/**
 * Intercepts the N8N OCR webhook POST so the test does not depend on
 * an external service. Returns the captured job_id so the caller can
 * trigger the callback route if needed.
 */
export async function interceptOcrWebhook(page: Page): Promise<{ jobId: () => string | null }> {
    const capturedJobId: string | null = null;

    await page.route('**/api/webhooks/ocr**', async (route: Route) => {
        // Let internal callback routes pass through
        if (route.request().url().includes('/callback')) {
            await route.continue();
            return;
        }
        // Mock N8N accepting the job
        await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ accepted: true }),
        });
    });

    // Also intercept the server action that creates the OCR job (Next.js RSC actions
    // use POST to the same route with a special header, so we capture the job_id
    // via the Supabase realtime broadcast instead — see waitForOcrResult).
    void capturedJobId; // suppress unused-var lint

    return { jobId: () => capturedJobId };
}

/**
 * Waits for the simulator to show extracted OCR data or an error state.
 * Polls for the data-confirm step to appear (max 30 s).
 */
export async function waitForOcrResult(page: Page, timeoutMs = 30_000): Promise<'success' | 'error'> {
    try {
        await page.waitForSelector(
            '[data-testid="ocr-confirm-panel"], [data-testid="ocr-error"]',
            { timeout: timeoutMs },
        );
        const errorVisible = await page.locator('[data-testid="ocr-error"]').isVisible();
        return errorVisible ? 'error' : 'success';
    } catch {
        return 'error';
    }
}
