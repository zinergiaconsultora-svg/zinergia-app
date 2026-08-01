#!/usr/bin/env node
/**
 * Start `next dev` against the STAGING Supabase project.
 *
 * Loads `.env.staging.local` (gitignored) BEFORE Next boots so its values win
 * over `.env.local` (which points at production). Used by the E2E suite, which
 * must never run against the production database.
 *
 * Usage: npm run dev:staging   (or it's launched automatically by Playwright)
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';

const ENV_FILE = '.env.staging.local';
if (!existsSync(ENV_FILE)) {
    console.error(`[dev:staging] Missing ${ENV_FILE}. See e2e/README.md to set up staging.`);
    process.exit(1);
}

// dotenv does not override already-set process.env; @next/env then loads the
// rest without overriding these, so staging values take precedence.
config({ path: ENV_FILE });

const devArgs = ['next', 'dev'];
const configuredBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

if (configuredBaseUrl) {
    const parsedBaseUrl = new URL(configuredBaseUrl);
    const allowedHosts = new Set(['localhost', '127.0.0.1', '::1']);
    const configuredPort = Number(parsedBaseUrl.port || (parsedBaseUrl.protocol === 'https:' ? 443 : 80));

    if (!allowedHosts.has(parsedBaseUrl.hostname) || !Number.isInteger(configuredPort) || configuredPort < 1 || configuredPort > 65535) {
        console.error('[dev:staging] PLAYWRIGHT_BASE_URL must use a valid local host and port.');
        process.exit(1);
    }

    devArgs.push('--port', String(configuredPort));
}

const nextCli = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const child = spawn(process.execPath, [nextCli, ...devArgs.slice(1)], {
    stdio: 'inherit',
    env: process.env,
    shell: false,
});
child.on('exit', (code) => process.exit(code ?? 0));
