#!/usr/bin/env node
/**
 * Stores the Google Drive refresh token ENCRYPTED in integration_credentials.
 *
 * Encrypts with the exact same scheme as src/lib/crypto/pii.ts
 * (AES-256-GCM, versioned `v1.<iv>.<tag>.<ct>` base64url) so the running app
 * can decrypt it, then upserts the row (provider = google_drive) via the
 * service-role client.
 *
 * Required env:
 *   APP_ENCRYPTION_KEY          (base64, 32 bytes) — must match the target env
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   GOOGLE_DRIVE_REFRESH_TOKEN  (the token printed by google-drive-auth.mjs)
 *
 * Usage (PowerShell):
 *   $env:APP_ENCRYPTION_KEY="..."; $env:NEXT_PUBLIC_SUPABASE_URL="..."; `
 *   $env:SUPABASE_SERVICE_ROLE_KEY="..."; $env:GOOGLE_DRIVE_REFRESH_TOKEN="..."; `
 *   node scripts/google-drive-save-token.mjs
 */

import { createCipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const KEY_B64 = process.env.APP_ENCRYPTION_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const REFRESH_TOKEN = process.env.GOOGLE_DRIVE_REFRESH_TOKEN;

function fail(msg) {
    console.error(`❌ ${msg}`);
    process.exit(1);
}

if (!KEY_B64) fail('Missing APP_ENCRYPTION_KEY (base64, 32 bytes).');
if (!SUPABASE_URL || !SERVICE_KEY) fail('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.');
if (!REFRESH_TOKEN) fail('Missing GOOGLE_DRIVE_REFRESH_TOKEN.');

const key = Buffer.from(KEY_B64, 'base64');
if (key.length !== 32) fail(`APP_ENCRYPTION_KEY must decode to 32 bytes (got ${key.length}).`);

// --- Mirror of src/lib/crypto/pii.ts encrypt() ---
function toB64Url(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function encrypt(plaintext) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv, { authTagLength: 16 });
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${toB64Url(iv)}.${toB64Url(tag)}.${toB64Url(ct)}`;
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const { error } = await supabase
    .from('integration_credentials')
    .upsert(
        {
            provider: 'google_drive',
            encrypted_refresh_token: encrypt(REFRESH_TOKEN),
            status: 'active',
            last_error: null,
        },
        { onConflict: 'provider' },
    );

if (error) fail(`Failed to save credentials: ${error.message}`);
console.log('✅ Refresh token guardado y cifrado en integration_credentials (provider=google_drive).');
process.exit(0);
