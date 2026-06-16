#!/usr/bin/env node
/**
 * One-off backfill: populate clients.cups_ciphertext / cups_hash /
 * dni_cif_ciphertext / dni_cif_hash from the legacy plaintext columns.
 *
 * Part of the PII encryption cutover (PR B). Run this ONCE, after deploying the
 * Phase 0 code, and BEFORE dropping the plaintext columns.
 *
 * It is IDEMPOTENT: it only touches rows where a plaintext value exists but the
 * corresponding ciphertext is still NULL. Running it twice is a no-op the second
 * time.
 *
 * The crypto here MIRRORS src/lib/crypto/pii.ts exactly (AES-256-GCM, v1 format,
 * HMAC-SHA-256 blind index, same normalization) so the values it writes are
 * byte-for-byte compatible with what the app produces and reads.
 *
 * Usage (PowerShell), with .env.local providing the three required vars:
 *
 *   node -r dotenv/config supabase/scripts/20260616_backfill_client_pii.mjs dotenv_config_path=.env.local
 *
 * Required env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   APP_ENCRYPTION_KEY     (base64, 32 bytes)
 *   APP_ENCRYPTION_PEPPER  (hex, >= 16 bytes)
 *
 * Add --dry-run to report what WOULD change without writing.
 */

import { createCipheriv, createHmac, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

// ── crypto (mirror of src/lib/crypto/pii.ts) ────────────────────────────────
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const CURRENT_VERSION = 'v1';

function toB64Url(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadKeyMaterial() {
    const rawKey = process.env.APP_ENCRYPTION_KEY;
    const rawPepper = process.env.APP_ENCRYPTION_PEPPER;
    if (!rawKey) throw new Error('APP_ENCRYPTION_KEY is not set');
    if (!rawPepper) throw new Error('APP_ENCRYPTION_PEPPER is not set');
    const encryptionKey = Buffer.from(rawKey, 'base64');
    if (encryptionKey.length !== KEY_LENGTH) {
        throw new Error(`APP_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes (got ${encryptionKey.length})`);
    }
    const pepper = Buffer.from(rawPepper, 'hex');
    if (pepper.length < 16) throw new Error(`APP_ENCRYPTION_PEPPER must be >= 16 bytes (got ${pepper.length})`);
    return { encryptionKey, pepper };
}

function encrypt(plaintext, { encryptionKey }) {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${CURRENT_VERSION}.${toB64Url(iv)}.${toB64Url(tag)}.${toB64Url(ct)}`;
}

function blindHashRaw(normalized, { pepper }) {
    return createHmac('sha256', pepper).update(normalized, 'utf8').digest('hex');
}

const normalizeCups = (raw) => raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
const normalizeDni = (raw) => raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');

// ── backfill ────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes('--dry-run');
const PAGE = 500;

async function main() {
    const keys = loadKeyMaterial();
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');

    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    console.log(`[backfill] ${DRY_RUN ? 'DRY-RUN — ' : ''}scanning clients with plaintext PII but no ciphertext...`);

    let scanned = 0;
    let updated = 0;
    let from = 0;

    for (;;) {
        const { data: rows, error } = await db
            .from('clients')
            .select('id, cups, dni_cif, cups_ciphertext, dni_cif_ciphertext')
            .order('id', { ascending: true })
            .range(from, from + PAGE - 1);

        if (error) throw new Error(`select failed: ${error.message}`);
        if (!rows || rows.length === 0) break;

        for (const row of rows) {
            scanned++;
            const patch = {};

            if (row.cups && !row.cups_ciphertext) {
                const norm = normalizeCups(String(row.cups));
                if (norm) {
                    patch.cups_ciphertext = encrypt(norm, keys);
                    patch.cups_hash = blindHashRaw(norm, keys);
                }
            }
            if (row.dni_cif && !row.dni_cif_ciphertext) {
                const norm = normalizeDni(String(row.dni_cif));
                if (norm) {
                    patch.dni_cif_ciphertext = encrypt(norm, keys);
                    patch.dni_cif_hash = blindHashRaw(norm, keys);
                }
            }

            if (Object.keys(patch).length === 0) continue;

            updated++;
            if (DRY_RUN) {
                console.log(`[backfill] would update ${row.id}: ${Object.keys(patch).join(', ')}`);
                continue;
            }
            const { error: upErr } = await db.from('clients').update(patch).eq('id', row.id);
            if (upErr) throw new Error(`update ${row.id} failed: ${upErr.message}`);
        }

        if (rows.length < PAGE) break;
        from += PAGE;
    }

    console.log(`[backfill] done. scanned=${scanned} ${DRY_RUN ? 'wouldUpdate' : 'updated'}=${updated}`);
}

main().catch((err) => {
    console.error('[backfill] FAILED:', err.message);
    process.exit(1);
});
