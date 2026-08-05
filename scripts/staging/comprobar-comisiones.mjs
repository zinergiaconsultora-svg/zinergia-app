#!/usr/bin/env node
/**
 * ¿Está el modelo de comisión por colaborador aplicado en staging?
 *
 * Solo lee y, en las funciones, provoca a propósito un rechazo con datos
 * inexistentes. No escribe nada.
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
const UUID_NULO = '00000000-0000-0000-0000-000000000000';

let fallos = 0;
const linea = (ok, texto) => {
    if (!ok) fallos += 1;
    console.log(`    ${ok ? '✓' : '✗'} ${texto}`);
};

console.log(`\n  Staging: ${new URL(url).host}`);

console.log('\n  Tabla de porcentajes');
const { error: errorTabla } = await supabase
    .from('collaborator_commission_rates')
    .select('id', { count: 'exact', head: true });
linea(!errorTabla, `collaborator_commission_rates${errorTabla ? ` — ${errorTabla.message.split('\n')[0]}` : ''}`);

console.log('\n  Columnas del extra en opportunities');
for (const columna of [
    'extra_commission_amount',
    'extra_commission_reason',
    'extra_commission_set_by',
    'extra_commission_set_at',
]) {
    const { error } = await supabase.from('opportunities').select(columna).limit(1);
    linea(!error, columna);
}

console.log('\n  Funciones');
const funciones = [
    ['get_collaborator_commission_rate', { p_profile_id: UUID_NULO }],
    ['set_collaborator_commission_rate', { p_profile_id: UUID_NULO, p_rate_bps: 5000, p_note: null }],
    ['set_opportunity_extra_commission', { p_opportunity_id: UUID_NULO, p_amount: 10, p_reason: null }],
];
for (const [nombre, args] of funciones) {
    const { error } = await supabase.rpc(nombre, args);
    // Un error de permisos o de dato inexistente demuestra que la función está y
    // se defiende. Solo "no la encuentro" significa que falta.
    const noExiste = error && /could not find|does not exist|schema cache/i.test(error.message);
    linea(!noExiste, `${nombre}${error && !noExiste ? `  (rechaza: ${error.message.split('\n')[0].slice(0, 40)})` : ''}`);
}

console.log(fallos === 0
    ? '\n  Todo aplicado.\n'
    : `\n  ${fallos} comprobacion(es) fallan.\n`);
process.exit(fallos === 0 ? 0 : 1);
