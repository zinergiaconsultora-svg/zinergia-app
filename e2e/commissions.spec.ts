import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const hasAgentCredentials = !!(
    process.env.E2E_AGENT_EMAIL && process.env.E2E_AGENT_PASSWORD
);

test.describe('commercial commissions workspace', () => {
    test.skip(!hasAgentCredentials, 'Agent staging credentials are required');

    test('replaces the legacy wallet with six traceable commission states', async ({ page }) => {
        const browserErrors: string[] = [];
        page.on('pageerror', (error) => browserErrors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') browserErrors.push(message.text());
        });

        await page.goto('/dashboard/wallet');

        await expect(page).toHaveURL(/\/dashboard\/commissions$/);
        await expect(page.getByRole('heading', { name: 'Comisiones', exact: true })).toBeVisible();
        await expect(page.getByText('Mi Cartera')).toHaveCount(0);
        await expect(page.getByRole('link', { name: 'Facturas fiscales' })).toBeVisible();

        for (const label of [
            'Pendientes',
            'En validación',
            'Disponibles',
            'Facturadas',
            'Pagadas',
            'Revertidas',
            'Ajustes',
        ]) {
            await expect(page.getByRole('button', { name: new RegExp(label) })).toBeVisible();
        }

        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
        expect(browserErrors).toEqual([]);

        const accessibility = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
        expect(accessibility.violations).toEqual([]);
    });

    test('keeps filters and amounts usable on mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/dashboard/commissions');

        await expect(page.getByText('Neto registrado')).toBeVisible();
        await expect(page.getByText('Disponible para facturar')).toBeVisible();
        await expect(page.getByRole('button', { name: /Todas/ })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);

        await page.goto('/dashboard/invoicing');
        await expect(page.getByRole('heading', { name: 'Facturación de comisiones' })).toBeVisible();
        await expect(page.getByRole('tab', { name: 'Todas' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Crear borrador' })).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
    });

    test('loads the fiscal invoicing workspace with role-safe actions', async ({ page }) => {
        const browserErrors: string[] = [];
        page.on('pageerror', (error) => browserErrors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') browserErrors.push(message.text());
        });

        await page.goto('/dashboard/invoicing');

        await expect(page.getByRole('heading', { name: 'Facturación de comisiones' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Crear borrador' })).toBeVisible();
        await expect(page.getByText('Por facturar')).toBeVisible();
        await expect(page.getByText('En trámite')).toBeVisible();
        await expect(page.getByText('Pagado')).toBeVisible();
        for (const label of ['Todas', 'Borrador', 'Emitida', 'Pagada', 'Cancelada']) {
            await expect(page.getByRole('tab', { name: label })).toBeVisible();
        }

        expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
        expect(browserErrors).toEqual([]);

        const accessibility = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
        expect(accessibility.violations).toEqual([]);
    });
});
