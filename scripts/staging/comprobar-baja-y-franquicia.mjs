#!/usr/bin/env node
/**
 * ¿Acepta ya el mando de autoridad un colaborador sin franquicia?
 *
 * Es la comprobación que no se podía hacer escribiendo directamente en la tabla:
 * el guardián lo impide, y con razón. Aquí se pide por el camino bueno, el mismo
 * que usa la aplicación.
 *
 * Deja al colaborador sin franquicia, que es el estado que buscamos con el
 * modelo nuevo. Cada llamada escribe su evento de auditoría — eso es la
 * auditoría funcionando, no un efecto secundario.
 *
 * Solo staging.
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';
import { randomUUID } from 'node:crypto';

loadEnv({ path: '.env.staging.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
    console.error('\n  Faltan credenciales de staging en .env.staging.local\n');
    process.exit(1);
}

if (new URL(url).host.split('.')[0] === 'gmjgkzaxmkaggsyczwcm') {
    console.error('\n  Este script no se ejecuta contra produccion.\n');
    process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log(`\n  Staging: ${new URL(url).host}\n`);

const { data: admin } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .is('parent_id', null)
    .is('franchise_id', null)
    .limit(1)
    .maybeSingle();

if (!admin) {
    console.error('  No hay administrador canonico en staging.\n');
    process.exit(1);
}

const { data: colaborador } = await supabase
    .from('profiles')
    .select('id, full_name, franchise_id, parent_id, authority_version')
    .eq('role', 'agent')
    .not('franchise_id', 'is', null)
    .limit(1)
    .maybeSingle();

if (!colaborador) {
    console.log('  Ningun colaborador tiene franquicia: ya estan todos en el modelo nuevo.\n');
    process.exit(0);
}

console.log(`  Colaborador de prueba: ${colaborador.full_name ?? colaborador.id.slice(0, 8)}`);
console.log(`  Antes: franquicia ${colaborador.franchise_id ? 'asignada' : 'sin asignar'}\n`);

const { error } = await supabase.rpc('change_profile_authority', {
    p_actor_id: admin.id,
    p_target_id: colaborador.id,
    p_desired_role: 'agent',
    p_parent_id: admin.id,
    p_franchise_id: null,
    p_expected_authority_version: colaborador.authority_version,
    p_reason_code: 'franchise_removal',
    p_request_id: randomUUID(),
});

if (error) {
    console.error(`  ✗ Sigue rechazando: ${error.message.split('\n')[0]}\n`);
    process.exit(1);
}

const { data: despues } = await supabase
    .from('profiles')
    .select('role, franchise_id, parent_id, authority_version')
    .eq('id', colaborador.id)
    .maybeSingle();

const bien = despues
    && despues.role === 'agent'
    && despues.franchise_id === null
    && despues.parent_id === admin.id;

console.log(`  ${bien ? '✓' : '✗'} colaborador sin franquicia, colgando de la administracion`);
console.log(`  ${despues && despues.authority_version === colaborador.authority_version + 1 ? '✓' : '✗'} la version de autoridad avanzo, asi que quedo registrado`);

console.log(bien ? '\n  El mando acepta el modelo nuevo.\n' : '\n  Algo no cuadra.\n');
process.exit(bien ? 0 : 1);
