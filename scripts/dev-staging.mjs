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
import { config } from 'dotenv';

const ENV_FILE = '.env.staging.local';
if (!existsSync(ENV_FILE)) {
    console.error(`[dev:staging] Missing ${ENV_FILE}. See e2e/README.md to set up staging.`);
    process.exit(1);
}

// dotenv does not override already-set process.env; @next/env then loads the
// rest without overriding these, so staging values take precedence.
config({ path: ENV_FILE });

const child = spawn('npx', ['next', 'dev'], {
    stdio: 'inherit',
    env: process.env,
    shell: true,
});
child.on('exit', (code) => process.exit(code ?? 0));
