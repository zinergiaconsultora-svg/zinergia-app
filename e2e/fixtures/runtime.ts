import { test as base, expect, type ConsoleMessage, type Page, type TestInfo } from '@playwright/test';

const FATAL_CONSOLE_ERROR = /Rendered more hooks|Invalid hook call|Minified React error|Uncaught Error/i;

function recordPageError(errors: string[], error: Error) {
    errors.push(error.stack || error.message);
}

function recordFatalConsoleError(errors: string[], message: ConsoleMessage) {
    if (message.type() !== 'error') return;

    const text = message.text();
    if (FATAL_CONSOLE_ERROR.test(text)) {
        errors.push(text);
    }
}

async function waitForLateRuntimeErrors(page: Page) {
    if (page.isClosed()) return;
    await page.waitForTimeout(250).catch(() => {});
}

export const test = base.extend({
    page: async ({ page }, runTest, testInfo: TestInfo) => {
        const runtimeErrors: string[] = [];
        const onPageError = (error: Error) => recordPageError(runtimeErrors, error);
        const onConsole = (message: ConsoleMessage) => recordFatalConsoleError(runtimeErrors, message);

        page.on('pageerror', onPageError);
        page.on('console', onConsole);

        await runTest(page);
        await waitForLateRuntimeErrors(page);

        expect(
            runtimeErrors,
            `Unexpected browser runtime errors in ${testInfo.titlePath.join(' > ')}:\n${runtimeErrors.join('\n\n')}`,
        ).toEqual([]);
    },
});

export { expect };
