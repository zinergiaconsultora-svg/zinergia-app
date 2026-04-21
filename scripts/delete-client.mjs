#!/usr/bin/env node
/**
 * RGPD Art. 17 — Derecho al olvido
 *
 * Borra un cliente por ID, registra la eliminación en audit_logs,
 * y confirma antes de actuar.
 *
 * Uso:
 *   node scripts/delete-client.mjs <client_id>
 *   node scripts/delete-client.mjs <client_id> --dry-run
 *
 * Requiere:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   en el entorno (o en .env.local si lo cargas manualmente).
 *
 * El audit log se conserva 5 años por obligación legal (RGPD Art. 5.2).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ──────────────────────────────────────────────────────────────────────────────
// Load .env.local if present (not using dotenv to avoid esm/cjs issues)
// ──────────────────────────────────────────────────────────────────────────────
function loadEnvLocal() {
    try {
        const envPath = resolve(process.cwd(), '.env.local');
        const lines = readFileSync(envPath, 'utf8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx < 0) continue;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = value;
        }
    } catch {
        // .env.local not present — rely on actual env vars
    }
}

loadEnvLocal();

// ──────────────────────────────────────────────────────────────────────────────
// Arg parsing
// ──────────────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2).filter(a => a !== '--dry-run');
const isDryRun = process.argv.includes('--dry-run');
const clientId = args[0];

if (!clientId || !/^[0-9a-f-]{36}$/.test(clientId)) {
    console.error('Usage: node scripts/delete-client.mjs <client_uuid> [--dry-run]');
    process.exit(1);
}

// ──────────────────────────────────────────────────────────────────────────────
// Supabase
// ──────────────────────────────────────────────────────────────────────────────
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
});

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
async function main() {
    // 1. Fetch client to confirm it exists and show summary
    const { data: client, error: fetchErr } = await supabase
        .from('clients')
        .select('id, name, email, status, cups, dni_cif, created_at')
        .eq('id', clientId)
        .maybeSingle();

    if (fetchErr) {
        console.error('Error fetching client:', fetchErr.message);
        process.exit(1);
    }
    if (!client) {
        console.error(`Client ${clientId} not found.`);
        process.exit(1);
    }

    console.log('\n── RGPD Art. 17 — Derecho al olvido ──────────────────────');
    console.log(`  ID:      ${client.id}`);
    console.log(`  Nombre:  ${client.name}`);
    console.log(`  Email:   ${client.email ?? '(sin email)'}`);
    console.log(`  Estado:  ${client.status}`);
    console.log(`  CUPS:    ${client.cups ?? '(no registrado)'}`);
    console.log(`  DNI/CIF: ${client.dni_cif ?? '(no registrado)'}`);
    console.log(`  Creado:  ${client.created_at}`);
    console.log('────────────────────────────────────────────────────────────\n');

    if (isDryRun) {
        console.log('[DRY RUN] No se ha eliminado nada. Ejecuta sin --dry-run para confirmar.');
        return;
    }

    // 2. Confirm interactively (skip if stdin is not a TTY, e.g. in CI)
    if (process.stdin.isTTY) {
        const readline = await import('readline');
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const answer = await new Promise(resolve =>
            rl.question('¿Confirmar eliminación permanente? (escribe SI para confirmar): ', resolve)
        );
        rl.close();
        if (answer !== 'SI') {
            console.log('Cancelado.');
            process.exit(0);
        }
    }

    // 3. Write audit log BEFORE deletion (so we have a record even if delete fails mid-way)
    const { error: auditErr } = await supabase
        .from('audit_logs')
        .insert({
            action: 'rgpd_deletion',
            table_name: 'clients',
            record_id: client.id,
            new_data: {
                reason: 'rgpd_art17_erasure_request',
                deleted_at: new Date().toISOString(),
                client_name: client.name,
                client_email: client.email,
                client_status: client.status,
            },
        });

    if (auditErr) {
        console.error('Error writing audit log:', auditErr.message);
        console.error('Aborting — client NOT deleted. Resolve the audit log issue first.');
        process.exit(1);
    }

    // 4. Delete the client (cascade handles proposals, ocr_jobs, etc.)
    const { error: deleteErr } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

    if (deleteErr) {
        console.error('Error deleting client:', deleteErr.message);
        console.error('Note: audit log entry was already written. Record the error manually.');
        process.exit(1);
    }

    console.log(`\n✓ Cliente ${client.id} (${client.name}) eliminado correctamente.`);
    console.log('  Se ha registrado la eliminación en audit_logs.');
    console.log('  Conserva este registro durante 5 años (obligación legal).\n');
}

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
