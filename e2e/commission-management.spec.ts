import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const hasAdminCredentials = !!(
    process.env.E2E_ADMIN_EMAIL && process.env.E2E_ADMIN_PASSWORD
);

test.describe('commission management', () => {
    test.skip(!hasAdminCredentials, 'Admin staging credentials are required');

    test('keeps commission configuration clear and balanced on desktop', async ({
        page,
    }) => {
        const browserErrors: string[] = [];
        page.on('pageerror', (error) => browserErrors.push(error.message));
        page.on('console', (message) => {
            if (message.type() === 'error') browserErrors.push(message.text());
        });

        await page.goto('/admin/commissions');
        await expect(
            page.getByRole('heading', { name: 'Trabajo pendiente' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Validar/ }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Liquidar/ }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Ajustes/ }),
        ).toBeVisible();
        await page.getByRole('button', { name: /Ajustes/ }).click();
        await expect(
            page.getByRole('heading', {
                name: 'Registrar incumplimiento de permanencia',
            }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Modelo económico' }).click();
        const initialSetup = page.getByRole('heading', {
            name: 'Configuración inicial',
        });

        if (await initialSetup.count()) {
            await expect(initialSetup).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Socios directos' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Red franquiciada' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Perfiles de socios' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Política de decomisión' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', {
                    name: 'Cálculo proporcional por días',
                }),
            ).toBeVisible();

            await page.getByLabel('Socio %').fill('80');
            await expect(page.getByText('20.00 %').last()).toBeVisible();
            await page.getByLabel('Comercial %').fill('55');
            await expect(page.getByText('30.00 %')).toBeVisible();
            await expect(
                page.getByRole('button', { name: 'Guardar configuración' }),
            ).toBeEnabled();
        } else {
            await expect(
                page.getByRole('heading', { name: 'Repartos vigentes' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', {
                    name: 'Preparar un nuevo reparto',
                }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Asignación de perfiles' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Política de decomisión' }),
            ).toBeVisible();

            const commercial = page.getByLabel('Socio comercial %');
            await commercial.fill('80');
            await expect(page.getByLabel('Franquicia %')).toHaveCount(0);
            await expect(page.getByText('20.00 %').last()).toBeVisible();

            await page
                .getByRole('button', { name: 'Red franquiciada' })
                .click();
            const franchise = page.getByLabel('Franquicia %');
            await expect(franchise).toBeVisible();
            await franchise.fill('10');
        }

        await page.getByRole('button', { name: 'Fiscal', exact: true }).click();
        await expect(
            page.getByRole('heading', { name: 'Entidad fiscal Zinergia' }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Autofacturación' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Guardar entidad' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: 'Proponer acuerdo' }),
        ).toBeDisabled();

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
        );
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
        await expect(
            page.getByRole('heading', { name: 'Trabajo pendiente' }),
        ).toBeVisible();
        await expect(
            page.getByRole('button', { name: /Ajustes/ }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Modelo económico' }).click();

        const initialSetup = page.getByRole('heading', {
            name: 'Configuración inicial',
        });
        if (await initialSetup.count()) {
            await expect(initialSetup).toBeVisible();
            await expect(
                page.getByRole('button', { name: 'Guardar configuración' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Política de decomisión' }),
            ).toBeVisible();
            await expect(
                page.getByText(/Devolución = días pendientes/),
            ).toBeVisible();
        } else {
            await expect(
                page.getByRole('heading', { name: 'Repartos vigentes' }),
            ).toBeVisible();
            await expect(
                page.getByRole('button', { name: /Guardar como v/ }),
            ).toBeVisible();
            await expect(
                page.getByRole('button', { name: 'Asignar reparto' }),
            ).toBeVisible();
            await expect(
                page.getByRole('heading', { name: 'Política de decomisión' }),
            ).toBeVisible();
        }

        await page.getByRole('button', { name: 'Fiscal', exact: true }).click();
        await expect(
            page.getByRole('heading', { name: 'Entidad fiscal Zinergia' }),
        ).toBeVisible();
        await expect(
            page.getByRole('heading', { name: 'Autofacturación' }),
        ).toBeVisible();

        const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(overflow).toBe(false);
    });
});
