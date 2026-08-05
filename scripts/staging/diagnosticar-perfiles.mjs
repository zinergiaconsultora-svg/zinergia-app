#!/usr/bin/env node
/**
 * Por qué los usuarios de prueba de staging no pueden entrar.
 *
 * Solo lee. No modifica nada.
 *
 * Uso:
 *   node scripts/staging/diagnosticar-perfiles.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { config as loadEnv } from 'dotenv';

loadEnv({ path: '.env.staging.local' });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
    console.error('\n  Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env.staging.local\n');
    process.exit(1);
}

// Los correos son de cuentas de prueba, pero el informe puede acabar pegado en
// cualquier sitio: se muestran recortados.
const oculta = (email) => {
    if (!email) return '(sin correo)';
    const [nombre, dominio] = email.split('@');
    return `${nombre.slice(0, 3)}…@${dominio ?? '?'}`;
};

const supabase = createClient(url, key, { auth: { persistSession: false } });

console.log(`\n  Proyecto: ${new URL(url).host}\n`);

const { data: usuarios, error: errorUsuarios } = await supabase.auth.admin.listUsers({ perPage: 200 });
if (errorUsuarios) {
    console.error(`  No se pudo listar usuarios: ${errorUsuarios.message}\n`);
    process.exit(1);
}

const buscados = [process.env.E2E_ADMIN_EMAIL, process.env.E2E_AGENT_EMAIL].filter(Boolean);
console.log(`  Usuarios en auth: ${usuarios.users.length}`);

const { data: perfiles, error: errorPerfiles } = await supabase
    .from('profiles')
    .select('id, email, role, franchise_id, parent_id');

if (errorPerfiles) {
    console.error(`  No se pudo leer profiles: ${errorPerfiles.message}\n`);
    process.exit(1);
}

console.log(`  Filas en profiles: ${perfiles.length}\n`);

for (const email of buscados) {
    const usuario = usuarios.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    const etiqueta = oculta(email);

    if (!usuario) {
        console.log(`  ${etiqueta}: NO existe en auth`);
        continue;
    }

    const perfil = perfiles.find(p => p.id === usuario.id);
    if (!perfil) {
        console.log(`  ${etiqueta}: existe en auth pero NO tiene fila en profiles  ← esta es la causa del 404`);
        continue;
    }

    console.log(`  ${etiqueta}: rol=${perfil.role ?? '(nulo)'}  franquicia=${perfil.franchise_id ? 'sí' : 'no'}  responsable=${perfil.parent_id ? 'sí' : 'no'}`);
}

console.log('\n  Reparto de roles en profiles:');
const porRol = perfiles.reduce((acc, p) => {
    const clave = `${p.role ?? '(nulo)'}${p.is_active === false ? ' (inactivo)' : ''}`;
    acc[clave] = (acc[clave] ?? 0) + 1;
    return acc;
}, {});
for (const [rol, n] of Object.entries(porRol)) console.log(`    ${rol}: ${n}`);

const { count: franquicias } = await supabase
    .from('franchises')
    .select('id', { count: 'exact', head: true });
console.log(`\n  Franquicias: ${franquicias ?? 0}\n`);

