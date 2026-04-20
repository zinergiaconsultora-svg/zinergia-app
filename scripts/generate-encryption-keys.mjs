#!/usr/bin/env node
/**
 * Generate fresh PII encryption key material for Zinergia.
 *
 * Prints two env-var lines to stdout:
 *
 *   APP_ENCRYPTION_KEY    — base64-encoded 32-byte key for AES-256-GCM
 *   APP_ENCRYPTION_PEPPER — hex-encoded 32-byte pepper for HMAC-SHA-256 blind index
 *
 * Usage:
 *
 *   node scripts/generate-encryption-keys.mjs
 *
 * Then copy the two lines into Vercel env vars (Production + Preview) and into
 * your local `.env.local`. Rotating these values invalidates existing ciphertexts
 * and blind indexes — see docs/rgpd-runbook.md before rotating in production.
 */

import { randomBytes } from 'node:crypto';

const key = randomBytes(32).toString('base64');
const pepper = randomBytes(32).toString('hex');

process.stdout.write(
    [
        '# Add these to Vercel (Production + Preview) and to .env.local.',
        '# DO NOT commit them. DO NOT share them in chat.',
        '# Back them up in a password manager — losing them makes all encrypted',
        '# PII and blind-index hashes permanently unreadable.',
        '',
        `APP_ENCRYPTION_KEY=${key}`,
        `APP_ENCRYPTION_PEPPER=${pepper}`,
        '',
    ].join('\n'),
);
