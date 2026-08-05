#!/usr/bin/env node
/**
 * Carga políticas de decomisión desde una hoja de cálculo.
 *
 * Uso:
 *   node scripts/decomisiones/cargar-decomisiones.mjs <fichero.csv>            (simulación)
 *   node scripts/decomisiones/cargar-decomisiones.mjs <fichero.csv> --aplicar  (escribe)
 *
 * Sin `--aplicar` no toca la base de datos: lee, valida y enseña lo que haría.
 * Ese es el modo por defecto a propósito — una política mal cargada se paga en
 * liquidaciones equivocadas, y las políticas son inmutables: cada carga crea una
 * versión nueva, no corrige la anterior.
 *
 * Requiere en el entorno (o en .env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * La función `configure_decommission_policy` solo la puede ejecutar `service_role`,
 * y además exige que el actor sea administrador. Por eso hay que indicar de parte
 * de quién se carga:
 *   ZINERGIA_ADMIN_ACTOR_ID=<uuid del perfil admin>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describePolicy, parseDecommissionCsv } from '../../src/lib/commissions/decommissionPolicyInput.ts';

function loadEnvLocal() {
    try {
        const lines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eq = trimmed.indexOf('=');
            if (eq < 0) continue;
            const key = trimmed.slice(0, eq).trim();
            const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
            if (!process.env[key]) process.env[key] = value;
        }
    } catch {
        // Sin .env.local sirven las variables del entorno.
    }
}

// Todo el informe va por stdout en el orden en que se escribe. Mezclarlo con
// stderr hace que, al redirigir la salida, los errores aparezcan antes que las
// políticas a las que se refieren.
function say(line = '') {
    process.stdout.write(`${line}\n`);
}

function fail(message) {
    say('');
    say(`  ${message}`);
    say('');
    process.exit(1);
}

loadEnvLocal();

const [, , filePath, ...flags] = process.argv;
const apply = flags.includes('--aplicar');

if (!filePath) {
    fail('Indica el fichero CSV.\n  node scripts/decomisiones/cargar-decomisiones.mjs mis-decomisiones.csv');
}

let content;
try {
    content = readFileSync(resolve(process.cwd(), filePath), 'utf8');
} catch {
    fail(`No se ha podido leer "${filePath}".`);
}

const { policies, errors } = parseDecommissionCsv(content);

if (policies.length > 0) {
    say('');
    say(`  ${policies.length} política(s) leída(s) correctamente:`);
    say('');
    for (const policy of policies) {
        say(describePolicy(policy).split('\n').map(line => `   ${line}`).join('\n'));
        say('');
    }
}

if (errors.length > 0) {
    say(`  ${errors.length} error(es) en el fichero:`);
    say('');
    for (const error of errors) say(`   · ${error}`);
}

if (policies.length === 0) {
    fail('No hay ninguna política válida que cargar.');
}

// Una carga a medias deja el sistema aplicando reglas a unas comercializadoras y
// no a otras, sin que nada lo indique. Es preferible arreglar el fichero entero.
if (errors.length > 0) {
    fail(`Hay ${errors.length} error(es) sin resolver. Corrígelos antes de aplicar: no se carga nada a medias.`);
}

if (!apply) {
    say('  Simulación: no se ha escrito nada.');
    say('  Añade --aplicar cuando los datos de arriba sean correctos.');
    say('');
    process.exit(0);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const actorId = process.env.ZINERGIA_ADMIN_ACTOR_ID;

if (!url || !serviceKey) fail('Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.');
if (!actorId) fail('Falta ZINERGIA_ADMIN_ACTOR_ID (el uuid del perfil de administrador que carga las políticas).');

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

let loaded = 0;
for (const policy of policies) {
    const label = policy.productCode
        ? `${policy.marketerName} / ${policy.productCode}`
        : policy.marketerName;

    const { data, error } = await supabase.rpc('configure_decommission_policy', {
        p_actor_id: actorId,
        p_marketer_name: policy.marketerName,
        p_product_code: policy.productCode,
        p_consolidation_days: policy.consolidationDays,
        p_clawback_days: policy.clawbackDays,
        p_bands: policy.bands,
    });

    if (error) {
        say(`   ✗ ${label}: ${error.message}`);
        // Las políticas son independientes entre sí y cada llamada es atómica, así
        // que seguir no deja nada a medias dentro de una política.
        continue;
    }

    loaded += 1;
    say(`   ✓ ${label} → ${data}`);
}

say('');
say(`  ${loaded} de ${policies.length} política(s) cargada(s).`);
say('');
process.exit(loaded === policies.length ? 0 : 1);
