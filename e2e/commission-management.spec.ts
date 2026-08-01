import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const hasAdminCredentials = !!(
    process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD
);

test.describe('commission management', () => {
    test.skip(!hasAdminCredentials, 'Admin staging credentials are required');

    test('keeps commission configuration clear and balanced on desktop', async ({ page }) => {
        const browserErrors: string[] = [];
        page.on('pageerror', (error) => browserErrors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') browserErrors.push(message.text());
        });

        await page.goto('/admin/commissions');
        await expect(page.getByRole('heading', { name: 'Trabajo pendiente' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Validar/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Liquidar/ })).toBeVisible();
        await expect(page.getByRole('button', { name: /Ajustes/ })).toBeVisible();
        await page.getByRole('button', { name: 'Modelo económico' }).click();
        const initialSetup = page.getByRole('heading', { name: 'Configuración inicial' });

        if (await initialSetup.count()) {
            await expect(initialSetup).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Socios directos' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Red franquiciada' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Perfiles de socios' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Políticas de decomisión' })).toBeVisible();

            await page.getByLabel('Socio %').fill('80');
            await expect(page.getByText('20.00 %')).toBeVisible();
            await page.getByLabel('Comercial %').fill('55');
            await expect(page.getByText('30.00 %')).toBeVisible();
            await expect(page.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled();

            await page.getByLabel('Comercializadora').fill('Verificación visual');
            await expect(page.getByRole('button', { name: 'Guardar política' })).toBeEnabled();
        } else {
            await expect(page.getByRole('heading', { name: 'Modelo económico' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Planes' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Asignaciones' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Revisión económica' })).toBeVisible();

            const commercial = page.getByLabel('Comercial %');
            const franchise = page.getByLabel('Franquicia %');
            await commercial.fill('80');
            await expect(franchise).toBeDisabled();
            await expect(page.getByText('20.00 %')).toBeVisible();

            await page.getByRole('button', { name: 'Franquicia' }).click();
            await expect(franchise).toBeEnabled();
            await franchise.fill('10');
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow).toBe(false);
        expect(browserErrors).toEqual([]);

        const accessibility = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
            .analyze();
        expect(accessibility.violations).toEqual([]);
    });

    test('remains usable on a narrow mobile viewport', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('/admin/commissions');
        await expect(page.getByRole('heading', { name: 'Trabajo pendiente' })).toBeVisible();
        await expect(page.getByRole('button', { name: /Ajustes/ })).toBeVisible();
        await page.getByRole('button', { name: 'Modelo económico' }).click();

        const initialSetup = page.getByRole('heading', { name: 'Configuración inicial' });
        if (await initialSetup.count()) {
            await expect(initialSetup).toBeVisible();
            await expect(page.getByRole('button', { name: 'Guardar configuración' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Políticas de decomisión' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Guardar política' })).toBeVisible();
        } else {
            await expect(page.getByRole('heading', { name: 'Modelo económico' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Guardar versión' })).toBeVisible();
            await expect(page.getByRole('button', { name: 'Asignar plan' })).toBeVisible();
        }

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
        expect(overflow).toBe(false);
    });
});
