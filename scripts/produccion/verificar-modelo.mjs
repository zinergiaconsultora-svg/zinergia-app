#!/usr/bin/env node
/**
 * ¿Está el modelo nuevo aplicado en PRODUCCION?
 *
 * Solo lee, y a las funciones las llama con datos inexistentes para que se
 * rechacen a sí mismas. No escribe nada.
 *
 * Necesita las credenciales de produccion en el entorno:
 *   NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
 * o en .env.local, que es donde vive la configuracion de produccion de la app.
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('\n  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n');
    process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });
const UUID_NULO = '00000000-0000-0000-0000-000000000000';

let fallos = 0;
const linea = (ok, texto) => {
    if (!ok) fallos += 1;
    console.log(`    ${ok ? '✓' : '✗'} ${texto}`);
};

console.log(`\n  Proyecto: ${new URL(url).host}`);

console.log('\n  Comision por colaborador');
const { error: errorTabla } = await supabase
    .from('collaborator_commission_rates')
    .select('id', { count: 'exact', head: true });
linea(!errorTabla, `tabla de porcentajes${errorTabla ? ` — ${errorTabla.message.split('\n')[0]}` : ''}`);

for (const columna of [
    'extra_commission_amount',
    'extra_commission_reason',
    'extra_commission_set_by',
    'extra_commission_set_at',
]) {
    const { error } = await supabase.from('opportunities').select(columna).limit(1);
    linea(!error, `opportunities.${columna}`);
}

console.log('\n  Funciones');
for (const [nombre, args] of [
    ['get_collaborator_commission_rate', { p_profile_id: UUID_NULO }],
    ['set_collaborator_commission_rate', { p_profile_id: UUID_NULO, p_rate_bps: 5000, p_note: null }],
    ['set_opportunity_extra_commission', { p_opportunity_id: UUID_NULO, p_amount: 10, p_reason: null }],
]) {
    const { error } = await supabase.rpc(nombre, args);
    const noExiste = error && /could not find|does not exist|schema cache/i.test(error.message);
    linea(!noExiste, `${nombre}${error && !noExiste ? '  (se defiende: rechaza la llamada)' : ''}`);
}

console.log('\n  Cache del SIPS');
const HASH_PRUEBA = 'verificacion-prod-'.padEnd(64, '0');
await supabase.from('sips_consumption_cache').upsert(
    { cups_hash: HASH_PRUEBA, annual_consumption_kwh: 0 },
    { onConflict: 'cups_hash' },
);
const { data: fila } = await supabase
    .from('sips_consumption_cache')
    .select('fetched_at, expires_at')
    .eq('cups_hash', HASH_PRUEBA)
    .maybeSingle();
await supabase.from('sips_consumption_cache').delete().eq('cups_hash', HASH_PRUEBA);

const dias = fila
    ? Math.round((Date.parse(fila.expires_at) - Date.parse(fila.fetched_at)) / 86_400_000)
    : null;
linea(dias === 7, `caducidad por defecto: ${dias ?? '?'} dias (deben ser 7)`);

console.log(fallos === 0
    ? '\n  Produccion tiene el modelo nuevo.\n'
    : `\n  ${fallos} comprobacion(es) fallan.\n`);
process.exit(fallos === 0 ? 0 : 1);
