#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const STAGING_REF = 'dnzytocmtmnptndeczny';
const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm';
const OPT_IN_ENV = 'PROFILE_AUTHORITY_EXPAND_ALLOW_STAGING_VERIFY';
const DATABASE_URL_ENV = 'PROFILE_AUTHORITY_EXPAND_STAGING_DB_URL';
const FORBIDDEN_LIBPQ_QUERY_PARAMS = new Set([
    'host', 'hostaddr', 'service', 'passfile', 'sslcert', 'sslkey', 'sslrootcert', 'options',
]);
const FIXTURE_ENVS = {
    __EXPAND_ADMIN_PROFILE_ID__: 'PROFILE_AUTHORITY_EXPAND_ADMIN_PROFILE_ID',
    __EXPAND_FRANCHISE_PROFILE_ID__: 'PROFILE_AUTHORITY_EXPAND_FRANCHISE_PROFILE_ID',
    __EXPAND_TARGET_PROFILE_ID__: 'PROFILE_AUTHORITY_EXPAND_TARGET_PROFILE_ID',
};
const structurePath = resolve(
    'supabase/scripts/profile-authority/verify_expand_structure.sql',
);
const transactionalPath = resolve(
    'supabase/scripts/profile-authority/verify_expand_transactional.sql',
);

function refuse(message) {
    console.error(`[profile-authority-expand] Refusing to run: ${message}`);
    process.exit(1);
}

if (process.env[OPT_IN_ENV] !== '1') {
    refuse(`set ${OPT_IN_ENV}=1 explicitly`);
}

const databaseUrl = process.env[DATABASE_URL_ENV];
if (!databaseUrl) {
    refuse(`set an explicit staging database URL in ${DATABASE_URL_ENV}`);
}

let parsedDatabaseUrl;
try {
    parsedDatabaseUrl = new URL(databaseUrl);
} catch {
    refuse(`${DATABASE_URL_ENV} is not a valid URL`);
}

if (!['postgres:', 'postgresql:'].includes(parsedDatabaseUrl.protocol)) {
    refuse('the explicit staging URL must use postgres:// or postgresql://');
}
for (const [name, value] of parsedDatabaseUrl.searchParams) {
    const normalizedName = name.toLowerCase();
    const normalizedValue = value.toLowerCase();
    if (FORBIDDEN_LIBPQ_QUERY_PARAMS.has(normalizedName)) {
        refuse(`database URL connection override ${name} is forbidden`);
    }
    if (normalizedName !== 'sslmode') {
        refuse(`database URL connection parameter ${name} is not allowed`);
    }
    if (!['require', 'verify-full'].includes(normalizedValue)) {
        refuse('sslmode must be require or verify-full; disable and connection overrides are forbidden');
    }
}
const requestedSslMode = parsedDatabaseUrl.searchParams.get('sslmode')?.toLowerCase() || 'require';

const hostname = parsedDatabaseUrl.hostname.toLowerCase();
const username = decodeURIComponent(parsedDatabaseUrl.username).toLowerCase();
const databaseIdentity = `${hostname}/${username}`;
if (databaseIdentity.includes(PRODUCTION_REF)) {
    refuse('the production project ref/host is never an allowed verification target');
}

const isApprovedDirectHost = hostname === `db.${STAGING_REF}.supabase.co`;
const isApprovedPooler = hostname.endsWith('.pooler.supabase.com')
    && username.endsWith(`.${STAGING_REF}`);
if (!isApprovedDirectHost && !isApprovedPooler) {
    refuse('the explicit URL is not demonstrably the approved staging project');
}

const expectedDatabase = decodeURIComponent(parsedDatabaseUrl.pathname.replace(/^\//, ''));
if (!/^[a-z0-9_-]+$/i.test(expectedDatabase)) {
    refuse('the explicit staging URL must include one safe database name');
}

function readFixtureUuids() {
    const fixtures = {};
    for (const [placeholder, envName] of Object.entries(FIXTURE_ENVS)) {
        const value = process.env[envName];
        if (!value) refuse(`set ${envName} to an explicit staging profile UUID`);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
            refuse(`${envName} is not a valid UUID`);
        }
        fixtures[placeholder] = value;
    }
    if (new Set(Object.values(fixtures)).size !== Object.keys(FIXTURE_ENVS).length) {
        refuse('admin, franchise and target fixture UUIDs must be distinct');
    }
    return fixtures;
}

function maskSqlSegment(segment) {
    return segment.replace(/[^\r\n]/g, ' ');
}

function topLevelControlSql(sql) {
    return sql
        .replace(/\$([a-z_][a-z0-9_]*)?\$[\s\S]*?\$\1\$/gi, maskSqlSegment)
        .replace(/\/\*[\s\S]*?\*\//g, maskSqlSegment)
        .replace(/--[^\r\n]*/g, maskSqlSegment)
        .replace(/'(?:''|[^'])*'/g, maskSqlSegment)
        .replace(/"(?:""|[^"])*"/g, maskSqlSegment);
}

function executableSql(sql) {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, maskSqlSegment)
        .replace(/--[^\r\n]*/g, maskSqlSegment)
        .replace(/'(?:''|[^'])*'/g, maskSqlSegment)
        .replace(/"(?:""|[^"])*"/g, maskSqlSegment);
}

function assertRollbackBoundary(sql, kind) {
    const topLevel = topLevelControlSql(sql.replace(/^\uFEFF/, ''));
    const beginStatements = [...topLevel.matchAll(/\bBEGIN\s*;/gi)];
    const rollbackStatements = [...topLevel.matchAll(/\bROLLBACK\s*;/gi)];
    const commitStatements = [...topLevel.matchAll(/\bCOMMIT\s*;/gi)];

    if (beginStatements.length !== 1 || rollbackStatements.length !== 1) {
        refuse(`${kind} gate must contain exactly one top-level BEGIN and ROLLBACK`);
    }
    if (commitStatements.length !== 0) refuse(`${kind} gate must never commit`);
    if (!topLevel.trimStart().toUpperCase().startsWith('BEGIN;')) {
        refuse(`${kind} gate BEGIN must be the first executable statement`);
    }
    const beginIndex = beginStatements[0].index;
    const rollbackIndex = rollbackStatements[0].index;
    if (beginIndex === undefined || rollbackIndex === undefined || rollbackIndex <= beginIndex) {
        refuse(`${kind} gate ROLLBACK must follow BEGIN`);
    }
    const afterRollback = executableSql(sql.slice(
        rollbackIndex + rollbackStatements[0][0].length,
    ));
    if (/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\b/i.test(afterRollback)) {
        refuse(`${kind} gate contains a mutation after its unconditional ROLLBACK`);
    }
}

function readGate(path, kind) {
    if (!existsSync(path)) refuse(`missing ${path}`);
    const sql = readFileSync(path, 'utf8');
    assertRollbackBoundary(sql, kind);
    if (kind === 'structure' && !/SET\s+TRANSACTION\s+READ\s+ONLY\s*;/i.test(sql)) {
        refuse('structure gate must set its transaction READ ONLY');
    }
    return sql;
}

function replaceFixturePlaceholders(sql, fixtures) {
    let resolvedSql = sql;
    for (const [placeholder, value] of Object.entries(fixtures)) {
        resolvedSql = resolvedSql.replaceAll(placeholder, value);
    }
    if (/__EXPAND_[A-Z0-9_]+__/i.test(resolvedSql)) {
        refuse('transactional gate contains an unresolved expand fixture placeholder');
    }
    return resolvedSql;
}

function buildPsqlEnvironment() {
    const childEnv = {};
    for (const name of [
        'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR',
        'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'LANG', 'LC_ALL',
    ]) {
        if (process.env[name] !== undefined) childEnv[name] = process.env[name];
    }
    childEnv.PGDATABASE = databaseUrl;
    childEnv.PGCONNECT_TIMEOUT = '10';
    childEnv.PGSSLMODE = requestedSslMode;
    return childEnv;
}

function sqlLiteral(value) {
    return `'${value.replaceAll("'", "''")}'`;
}

const connectionPreflightSql = `
DO $profile_authority_expand_preflight$
BEGIN
    IF current_database() IS DISTINCT FROM ${sqlLiteral(expectedDatabase)}
       OR current_user IS NULL
       OR inet_server_addr() IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_stat_ssl ssl_state
           WHERE ssl_state.pid = pg_backend_pid()
             AND ssl_state.ssl IS TRUE
       ) THEN
        RAISE EXCEPTION 'staging connection preflight failed';
    END IF;
END
$profile_authority_expand_preflight$;
`;

function runGate(sql, label) {
    const result = spawnSync(
        process.platform === 'win32' ? 'psql.exe' : 'psql',
        ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--file', '-'],
        {
            cwd: resolve('.'),
            env: buildPsqlEnvironment(),
            input: `${connectionPreflightSql}\n${sql}`,
            stdio: ['pipe', 'inherit', 'inherit'],
            encoding: 'utf8',
            shell: false,
        },
    );

    if (result.error) {
        throw new Error(`${label} gate could not start psql: ${result.error.message}`);
    }
    if (result.status !== 0) {
        throw new Error(`${label} gate failed with psql status ${result.status}`);
    }
}

const fixtureUuids = readFixtureUuids();
const safeStructureSql = readGate(structurePath, 'structure');
const safeTransactionalSql = replaceFixturePlaceholders(
    readGate(transactionalPath, 'transactional'),
    fixtureUuids,
);

runGate(safeStructureSql, 'expand structure');
runGate(safeTransactionalSql, 'expand transactional');

console.log('[profile-authority-expand] staging verification passed; no Auth Admin operation was attempted');
