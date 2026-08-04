#!/usr/bin/env node
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'dnzytocmtmnptndeczny';
const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm';
const ENV_FILE = '.env.staging.local';
const structurePath = 'supabase/scripts/profile-authority/verify_structure.sql';
const transactionalPath = 'supabase/scripts/profile-authority/verify_transactional.sql';
const fixturesPath = 'scripts/profile-authority/fixtures.json';

function refuse(message) {
    console.error(`[profile-authority] Refusing to run: ${message}`);
    process.exit(1);
}

if (process.env.PROFILE_AUTHORITY_ALLOW_STAGING_VERIFY !== '1') {
    refuse('set PROFILE_AUTHORITY_ALLOW_STAGING_VERIFY=1 explicitly');
}
if (!existsSync(ENV_FILE)) refuse(`missing ${ENV_FILE}`);
config({ path: ENV_FILE, quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const databaseUrl = process.env.PROFILE_AUTHORITY_STAGING_DB_URL;
if (!supabaseUrl || !anonKey || !databaseUrl) {
    refuse('missing staging API URL, anon key or PROFILE_AUTHORITY_STAGING_DB_URL');
}

const apiHostname = new URL(supabaseUrl).hostname;
if (apiHostname !== `${STAGING_REF}.supabase.co` || apiHostname.includes(PRODUCTION_REF)) {
    refuse('Supabase API URL is not the approved staging ref');
}

let parsedDatabaseUrl;
try {
    parsedDatabaseUrl = new URL(databaseUrl);
} catch {
    refuse('PROFILE_AUTHORITY_STAGING_DB_URL is not a valid URL');
}
if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    refuse('staging DB URL must use postgres:// or postgresql://');
}
const directHostMatches = parsedDatabaseUrl.hostname === `db.${STAGING_REF}.supabase.co`;
const poolerMatches = parsedDatabaseUrl.hostname.endsWith('.pooler.supabase.com')
    && decodeURIComponent(parsedDatabaseUrl.username).endsWith(`.${STAGING_REF}`);
const databaseIdentity = `${parsedDatabaseUrl.hostname}/${decodeURIComponent(parsedDatabaseUrl.username)}`;
if ((!directHostMatches && !poolerMatches) || databaseIdentity.includes(PRODUCTION_REF)) {
    refuse('explicit DB URL is not demonstrably the approved staging project');
}

const crashWindows = JSON.parse(readFileSync(fixturesPath, 'utf8')).crashWindows;
console.error(
    `[profile-authority] RED: real Auth lifecycle verification is not implemented; `
    + `${crashWindows.map((scenario) => scenario.id).join(', ')} remain blocked. No Auth mutation will be attempted.`,
);

function runSqlFile(path, replacements = {}) {
    let sql = readFileSync(path, 'utf8');
    for (const [token, value] of Object.entries(replacements)) {
        if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error(`unsafe UUID replacement for ${token}`);
        sql = sql.replaceAll(token, value);
    }
    const tempDir = mkdtempSync(join(tmpdir(), 'zinergia-profile-authority-'));
    const tempFile = join(tempDir, 'verify.sql');
    writeFileSync(tempFile, sql, { encoding: 'utf8', flag: 'wx' });
    try {
        const command = resolvePsqlCommand();
        const result = spawnSync(
            command,
            ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--dbname', databaseUrl, '--file', tempFile],
            { cwd: resolve('.'), env: buildPsqlEnvironment(), stdio: 'inherit', shell: false },
        );
        if (result.status !== 0) throw new Error(`${path} failed (expected RED before ZIN-SDD-041 migrations)`);
    } finally {
        unlinkSync(tempFile);
        rmdirSync(tempDir);
    }
}

function resolvePsqlCommand() {
    if (process.platform !== 'win32') return 'psql';

    const postgresRoot = join(process.env.ProgramFiles ?? 'C:\\Program Files', 'PostgreSQL');
    if (existsSync(postgresRoot)) {
        for (const version of readdirSync(postgresRoot).sort().reverse()) {
            const candidate = join(postgresRoot, version, 'bin', 'psql.exe');
            if (existsSync(candidate)) return candidate;
        }
    }
    return 'psql.exe';
}

function buildPsqlEnvironment() {
    const childEnv = {};
    for (const name of [
        'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR',
        'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LANG', 'LC_ALL',
    ]) {
        if (process.env[name] !== undefined) childEnv[name] = process.env[name];
    }
    childEnv.PGCONNECT_TIMEOUT = '10';
    childEnv.PGSSLMODE = parsedDatabaseUrl.searchParams.get('sslmode')?.toLowerCase() || 'require';
    return childEnv;
}

function client() {
    return createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

async function signIn(prefix) {
    const email = process.env[`${prefix}_EMAIL`];
    const password = process.env[`${prefix}_PASSWORD`];
    if (!email || !password) refuse(`missing ${prefix}_EMAIL/PASSWORD`);
    const actor = client();
    const { data, error } = await actor.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) throw new Error(`${prefix} synthetic read fixture cannot sign in`);
    return { client: actor, id: data.user.id };
}

// The structural verifier is read-only and runs before any network fixture read.
runSqlFile(structurePath);

const anon = client();
const actors = {
    agentA: await signIn('PROFILE_AUTHORITY_AGENT_A'),
    agentB: await signIn('PROFILE_AUTHORITY_AGENT_B'),
    other: await signIn('PROFILE_AUTHORITY_AGENT_OTHER'),
    franchise: await signIn('PROFILE_AUTHORITY_FRANCHISE'),
    admin: await signIn('PROFILE_AUTHORITY_ADMIN'),
};
const fixtureIds = Object.values(actors).map((actor) => actor.id);

const profileResult = await actors.admin.client.from('profiles')
    .select('id,role,parent_id,franchise_id,full_name,authority_version').in('id', fixtureIds);
if (profileResult.error || profileResult.data.length !== fixtureIds.length) {
    throw new Error('synthetic profile fixture matrix is missing or outside Admin read scope');
}
const profiles = Object.fromEntries(profileResult.data.map((profile) => [
    Object.entries(actors).find(([, actor]) => actor.id === profile.id)?.[0],
    profile,
]));
if (profiles.agentA.role !== 'agent' || profiles.agentB.role !== 'agent' || profiles.other.role !== 'agent'
    || profiles.franchise.role !== 'franchise' || profiles.admin.role !== 'admin') {
    throw new Error('fixture role matrix is invalid');
}
if (profiles.agentA.franchise_id !== profiles.agentB.franchise_id
    || profiles.agentA.franchise_id !== profiles.franchise.franchise_id
    || profiles.other.franchise_id === profiles.agentA.franchise_id) {
    throw new Error('fixture tenant matrix is invalid');
}

const anonRows = await anon.from('profiles').select('id').in('id', fixtureIds);
if (anonRows.error === null && (anonRows.data?.length ?? 0) > 0) {
    throw new Error('anon can read profile fixtures');
}

async function visibleIds(actor) {
    const { data, error } = await actor.from('profiles').select('id').in('id', fixtureIds);
    if (error) throw new Error('safe profile projection unexpectedly failed');
    return new Set((data ?? []).map((row) => row.id));
}

const agentVisible = await visibleIds(actors.agentA.client);
if (!agentVisible.has(actors.agentA.id) || agentVisible.has(actors.agentB.id) || agentVisible.has(actors.other.id)) {
    throw new Error('Agent REST row scope is invalid');
}
const franchiseVisible = await visibleIds(actors.franchise.client);
if (!franchiseVisible.has(actors.agentA.id) || !franchiseVisible.has(actors.agentB.id)
    || franchiseVisible.has(actors.other.id)) throw new Error('Franchise REST row scope is invalid');
const adminVisible = await visibleIds(actors.admin.client);
if (fixtureIds.some((id) => !adminVisible.has(id))) throw new Error('Admin REST row scope is invalid');

for (const [name, actor] of Object.entries(actors)) {
    const protectedRead = await actor.client.from('profiles')
        .select('iban,fiscal_verified,drive_folder_id').eq('id', actor.id);
    if (!protectedRead.error) throw new Error(`${name} JWT can directly read protected profile columns`);
}

// All write probes execute through one database transaction whose final statement is ROLLBACK.
runSqlFile(transactionalPath, {
    __ADMIN_ID__: actors.admin.id,
    __TARGET_ID__: actors.agentA.id,
    __SAME_FRANCHISE_ID__: actors.agentB.id,
    __OTHER_AGENT_ID__: actors.other.id,
    __FRANCHISE_ACTOR_ID__: actors.franchise.id,
    __NEXT_PARENT_ID__: profiles.other.parent_id,
    __NEXT_FRANCHISE_ID__: profiles.other.franchise_id,
});

throw new Error(
    'RED: database/read-only REST verification ran, but the five real Auth crash windows and convergence remain unimplemented',
);
