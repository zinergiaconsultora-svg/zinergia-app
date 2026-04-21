#!/usr/bin/env node
/**
 * Backfill PII encryption for existing clients.
 *
 * Reads every client row that has a plaintext `cups` or `dni_cif` but no
 * corresponding hash, encrypts + hashes them, and writes the encrypted
 * columns back to the database.
 *
 * This script is idempotent: rows that already have `cups_hash` set are
 * skipped. Run it multiple times if needed (e.g. after a partial run).
 *
 * Prerequisites:
 *   - APP_ENCRYPTION_KEY and APP_ENCRYPTION_PEPPER must be set in env.
 *   - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env (or
 *     loaded from .env.local via --env-file flag).
 *   - The migration 20260421_pii_encryption_columns.sql must be applied.
 *
 * Usage:
 *   node --env-file=.env.local scripts/backfill-pii-encryption.mjs
 *   node --env-file=.env.local scripts/backfill-pii-encryption.mjs --dry-run
 *
 * Options:
 *   --dry-run   Print what would be updated without writing anything.
 *   --batch N   Process N rows at a time (default: 100).
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Inline crypto primitives (avoid ESM/CJS interop issues with the TS module)
// ---------------------------------------------------------------------------
import { createCipheriv, createHmac, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function toB64Url(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadKeys() {
    const rawKey = process.env.APP_ENCRYPTION_KEY;
    const rawPepper = process.env.APP_ENCRYPTION_PEPPER;
    if (!rawKey) throw new Error('APP_ENCRYPTION_KEY is not set');
    if (!rawPepper) throw new Error('APP_ENCRYPTION_PEPPER is not set');
    const encryptionKey = Buffer.from(rawKey, 'base64');
    if (encryptionKey.length !== 32) throw new Error(`APP_ENCRYPTION_KEY must be 32 bytes (got ${encryptionKey.length})`);
    const pepper = Buffer.from(rawPepper, 'hex');
    if (pepper.length < 16) throw new Error(`APP_ENCRYPTION_PEPPER must be ≥16 bytes (got ${pepper.length})`);
    return { encryptionKey, pepper };
}

function encrypt(plaintext, encryptionKey) {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, encryptionKey, iv, { authTagLength: AUTH_TAG_LENGTH });
    const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${toB64Url(iv)}.${toB64Url(tag)}.${toB64Url(ct)}`;
}

function blindHash(normalized, pepper) {
    return createHmac('sha256', pepper).update(normalized, 'utf8').digest('hex');
}

function normalizeCups(raw) {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function normalizeDni(raw) {
    return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const isDryRun = process.argv.includes('--dry-run');
const batchArg = process.argv.indexOf('--batch');
const BATCH_SIZE = batchArg !== -1 ? parseInt(process.argv[batchArg + 1], 10) : 100;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
});

const { encryptionKey, pepper } = loadKeys();

console.log(`\n🔐 PII backfill starting (${isDryRun ? 'DRY RUN — no writes' : 'LIVE MODE'})`);
console.log(`   Batch size: ${BATCH_SIZE}\n`);

let offset = 0;
let totalProcessed = 0;
let totalUpdated = 0;
let totalSkipped = 0;

while (true) {
    // Fetch rows that need backfilling: have cups OR dni_cif but missing at
    // least one of the hash columns.
    const { data: rows, error } = await supabase
        .from('clients')
        .select('id, cups, dni_cif, cups_hash, dni_cif_hash')
        .or('cups_hash.is.null,dni_cif_hash.is.null')
        .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
        console.error('❌ Query error:', error.message);
        process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
        totalProcessed++;
        const update = {};

        if (row.cups && !row.cups_hash) {
            const normalized = normalizeCups(row.cups);
            if (normalized) {
                update.cups_ciphertext = encrypt(normalized, encryptionKey);
                update.cups_hash = blindHash(normalized, pepper);
            }
        }

        if (row.dni_cif && !row.dni_cif_hash) {
            const normalized = normalizeDni(row.dni_cif);
            if (normalized) {
                update.dni_cif_ciphertext = encrypt(normalized, encryptionKey);
                update.dni_cif_hash = blindHash(normalized, pepper);
            }
        }

        if (Object.keys(update).length === 0) {
            totalSkipped++;
            continue;
        }

        if (!isDryRun) {
            const { error: updateError } = await supabase
                .from('clients')
                .update(update)
                .eq('id', row.id);
            if (updateError) {
                console.error(`❌ Failed to update client ${row.id}:`, updateError.message);
            } else {
                totalUpdated++;
                process.stdout.write('.');
            }
        } else {
            console.log(`  [DRY] Would update client ${row.id}: ${Object.keys(update).join(', ')}`);
            totalUpdated++;
        }
    }

    offset += rows.length;
    if (rows.length < BATCH_SIZE) break; // last page
}

console.log(`\n\n✅ Done.`);
console.log(`   Processed : ${totalProcessed}`);
console.log(`   Updated   : ${totalUpdated}`);
console.log(`   Skipped   : ${totalSkipped} (already had hashes)`);
if (isDryRun) console.log('\n   Re-run without --dry-run to apply changes.');
