#!/usr/bin/env node
/**
 * ¿Está aplicada en staging la caducidad de 7 días de la caché del SIPS?
 *
 * Solo lee. No modifica nada.
 *
 * Escribe una fila de prueba con un hash que no corresponde a ningún CUPS real,
 * mira qué caducidad le pone la base de datos por defecto, y la borra.
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.staging.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('\n  Faltan credenciales de staging en .env.staging.local\n');
    process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// No es el hash de ningún CUPS: es una cadena reconocible para poder limpiarla.
const HASH_PRUEBA = 'comprobacion-ttl-'.padEnd(64, '0');

console.log(`\n  Staging: ${new URL(url).host}\n`);

const { error: errorInsert } = await supabase
    .from('sips_consumption_cache')
    .upsert({ cups_hash: HASH_PRUEBA, annual_consumption_kwh: 0 }, { onConflict: 'cups_hash' });

if (errorInsert) {
    console.error(`  No se pudo escribir la fila de prueba: ${errorInsert.message}\n`);
    process.exit(1);
}

const { data } = await supabase
    .from('sips_consumption_cache')
    .select('fetched_at, expires_at')
    .eq('cups_hash', HASH_PRUEBA)
    .maybeSingle();

await supabase.from('sips_consumption_cache').delete().eq('cups_hash', HASH_PRUEBA);

if (!data) {
    console.error('  La fila de prueba no se pudo leer.\n');
    process.exit(1);
}

const dias = Math.round((Date.parse(data.expires_at) - Date.parse(data.fetched_at)) / 86_400_000);
console.log(`  Caducidad por defecto: ${dias} días`);
console.log(dias === 7
    ? '  ✓ La migración está aplicada.\n'
    : '  ✗ Sigue sin aplicarse; debería ser 7.\n');

process.exit(dias === 7 ? 0 : 1);
