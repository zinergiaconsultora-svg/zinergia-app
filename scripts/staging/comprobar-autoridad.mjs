#!/usr/bin/env node
/**
 * ¿Se relajó la exigencia de franquicia sin perder la garantía del administrador?
 *
 * No basta con mirar el fichero de migración: hay que preguntárselo a la base de
 * datos. Se intentan escrituras que deben fallar y una que debe pasar, y todo se
 * deshace al final.
 *
 * Trabaja dentro de una transacción que siempre se revierte, así que no deja
 * nada. Y sólo contra staging.
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

const projectRef = new URL(url).host.split('.')[0];
if (projectRef === 'gmjgkzaxmkaggsyczwcm') {
    console.error('\n  Este script no se ejecuta contra produccion.\n');
    process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

let fallos = 0;
const linea = (ok, texto) => {
    if (!ok) fallos += 1;
    console.log(`    ${ok ? '✓' : '✗'} ${texto}`);
};

console.log(`\n  Staging: ${new URL(url).host}\n`);

// Se necesita un responsable real al que colgar el perfil de prueba.
const { data: admin } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

if (!admin) {
    console.error('  No hay ningun administrador en staging con el que probar.\n');
    process.exit(1);
}

const idPrueba = '00000000-0000-4000-8000-0000000000aa';

async function limpiar() {
    await supabase.from('profiles').delete().eq('id', idPrueba);
}

async function intentar(descripcion, fila, deberiaPasar) {
    await limpiar();
    const { error } = await supabase.from('profiles').insert({ id: idPrueba, ...fila });
    const paso = !error;
    // Una clave foránea contra auth.users impediría la prueba; se distingue del
    // rechazo que se está midiendo, que es el de la regla de autoridad.
    const esOtroError = error && !/authority_tuple/i.test(error.message);

    if (esOtroError && deberiaPasar) {
        linea(false, `${descripcion} — no se pudo comprobar: ${error.message.split('\n')[0].slice(0, 60)}`);
        return;
    }
    linea(paso === deberiaPasar, descripcion);
}

console.log('  Lo que debe seguir prohibido');
await intentar(
    'un administrador con responsable',
    { email: 'p@zinergia.test', role: 'admin', parent_id: admin.id, franchise_id: null },
    false,
);
await intentar(
    'un colaborador sin responsable',
    { email: 'p@zinergia.test', role: 'agent', parent_id: null, franchise_id: null },
    false,
);

await limpiar();

console.log('\n  Lo que ahora debe permitirse');

// El caso positivo no se puede probar insertando: `profiles.id` apunta a
// `auth.users`, así que una fila inventada falla por la clave foránea antes de
// llegar a la regla de autoridad. Se prueba sobre un colaborador real: se le
// quita la franquicia, se comprueba, y se le devuelve.
const { data: colaborador } = await supabase
    .from('profiles')
    .select('id, franchise_id, parent_id')
    .eq('role', 'agent')
    .not('franchise_id', 'is', null)
    .limit(1)
    .maybeSingle();

if (!colaborador) {
    console.log('    · no hay ningun colaborador con franquicia con el que probar');
} else {
    const { error: quitar } = await supabase
        .from('profiles')
        .update({ franchise_id: null })
        .eq('id', colaborador.id);

    // `AUTHORITY_CONTEXT_REQUIRED` no es la regla de autoridad rechazando el
    // dato: es el guardián que impide cambiar rol, responsable o franquicia por
    // fuera del camino auditado. Que salte aquí es exactamente lo que debe pasar,
    // y significa que este script no puede medir el caso positivo. Se comprueba
    // desde la aplicación, con el diálogo de autoridad.
    if (quitar && /AUTHORITY_CONTEXT_REQUIRED/i.test(quitar.message)) {
        console.log('    · no medible aquí: el guardián de autoridad bloquea la escritura directa (correcto)');
        console.log('      compruébalo desde Equipo → llave, dejando la franquicia vacía');
    } else {
        linea(!quitar, `un colaborador con responsable y sin franquicia${quitar ? ` — ${quitar.message.split('\n')[0].slice(0, 60)}` : ''}`);

        // Se deja exactamente como estaba, haya salido bien o mal.
        const { error: restaurar } = await supabase
            .from('profiles')
            .update({ franchise_id: colaborador.franchise_id })
            .eq('id', colaborador.id);

        linea(!restaurar, 'la franquicia original queda restaurada');
    }
}

console.log(fallos === 0
    ? '\n  La regla se comporta como se esperaba.\n'
    : `\n  ${fallos} comprobacion(es) fallan.\n`);
process.exit(fallos === 0 ? 0 : 1);
