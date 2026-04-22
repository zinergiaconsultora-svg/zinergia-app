import { defineConfig, devices } from '@playwright/test';

/**
 * E2E test configuration for Zinergia.
 *
 * Required env vars (add to .env.test.local or CI secrets):
 *   PLAYWRIGHT_BASE_URL     — defaults to http://localhost:3000
 *   E2E_AGENT_EMAIL         — test agent user email
 *   E2E_AGENT_PASSWORD      — test agent user password
 *   E2E_ADMIN_EMAIL         — test admin user email
 *   E2E_ADMIN_PASSWORD      — test admin user password
 */
export default defineConfig({
    testDir: './e2e',
    /* Run files in parallel */
    fullyParallel: true,
    /* Fail the build on CI if test.only is accidentally left */
    forbidOnly: !!process.env.CI,
    /* Retry flaky tests on CI only */
    retries: process.env.CI ? 2 : 0,
    /* Limit parallelism on CI */
    workers: process.env.CI ? 1 : undefined,

    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],

    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000',
        /* Capture screenshot on failure */
        screenshot: 'only-on-failure',
        /* Capture video on first retry */
        video: 'on-first-retry',
        /* Record trace on first retry */
        trace: 'on-first-retry',
        /* Reasonable timeout per action */
        actionTimeout: 10_000,
    },

    projects: [
        /* Global setup — creates authenticated storage states */
        {
            name: 'setup',
            testMatch: /global\.setup\.ts/,
        },
        /* Main test suite — requires auth */
        {
            name: 'chromium',
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'e2e/.auth/agent.json',
            },
            dependencies: ['setup'],
            testIgnore: /global\.setup\.ts/,
        },
        /* Admin tests */
        {
            name: 'chromium-admin',
            use: {
                ...devices['Desktop Chrome'],
                storageState: 'e2e/.auth/admin.json',
            },
            dependencies: ['setup'],
            testMatch: /admin\.spec\.ts/,
        },
    ],

    /* Start the dev server automatically when running locally */
    webServer: process.env.CI
        ? undefined
        : {
              command: 'npm run dev',
              url: 'http://localhost:3000',
              reuseExistingServer: true,
              timeout: 120_000,
          },
});
