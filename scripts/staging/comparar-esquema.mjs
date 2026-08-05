#!/usr/bin/env node
/**
 * Qué le falta a staging respecto a lo que espera el código de hoy.
 *
 * Solo lee. No modifica nada.
 *
 * Un entorno de pruebas con el esquema atrasado no avisa: la aplicación arranca,
 * el acceso funciona, y los fallos aparecen como páginas que no cargan. Esta
 * comprobación pone nombre a lo que falta.
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { readdirSync } from 'node:fs';

loadEnv({ path: '.env.staging.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('\n  Faltan credenciales de staging en .env.staging.local\n');
    process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Tablas que el código actual da por hechas.
const TABLAS = [
    'profiles',
    'clients',
    'supply_points',
    'proposals',
    'contracts',
    'ocr_jobs',
    'franchises',
    'network_invitations',
    'sips_consents',
    'sips_query_audit',
    'client_ownership_events',
    'client_ownership_transfer_requests',
    'commission_events',
    'commission_decommission_policies',
    'commission_decommission_bands',
    'commission_plans',
    'lv_zinergia_tarifas',
    'tariff_commissions',
];

// Funciones añadidas por las migraciones de agosto.
const FUNCIONES = [
    ['authorize_sips_consumption', { p_cups_hash: '0'.repeat(64) }],
    ['get_sips_consent_status', { p_cups_hash: '0'.repeat(64) }],
    ['configure_decommission_policy', null],
    ['transfer_client_ownership', null],
];

console.log(`\n  Staging: ${new URL(url).host}\n`);
console.log('  Tablas:');

const faltan = [];
for (const tabla of TABLAS) {
    const { error } = await supabase.from(tabla).select('*', { count: 'exact', head: true });
    if (error) {
        faltan.push(tabla);
        console.log(`    ✗ ${tabla} — ${error.message.split('\n')[0]}`);
    }
}
if (faltan.length === 0) console.log('    todas presentes');

console.log('\n  Funciones:');
for (const [nombre, args] of FUNCIONES) {
    const { error } = await supabase.rpc(nombre, args ?? {});
    // Un error de argumentos significa que la función existe; solo importa si no
    // se encuentra.
    const noExiste = error && /could not find|does not exist|schema cache/i.test(error.message);
    console.log(`    ${noExiste ? '✗' : '✓'} ${nombre}${noExiste ? ' — no existe' : ''}`);
}

console.log('\n  Migraciones en el repositorio:');
const migraciones = readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
console.log(`    ${migraciones.length} ficheros, la última: ${migraciones[migraciones.length - 1]}`);
console.log('');
