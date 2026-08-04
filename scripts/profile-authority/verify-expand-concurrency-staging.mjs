#!/usr/bin/env node
import { createRequire } from 'node:module';
import { delimiter, isAbsolute, relative, resolve, sep } from 'node:path';

const STAGING_REF = 'dnzytocmtmnptndeczny';
const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm';
const OPT_IN_ENV = 'PROFILE_AUTHORITY_EXPAND_ALLOW_STAGING_CONCURRENCY_VERIFY';
const DATABASE_URL_ENV = 'PROFILE_AUTHORITY_EXPAND_STAGING_DB_URL';
const FORBIDDEN_LIBPQ_QUERY_PARAMS = new Set([
    'host', 'hostaddr', 'service', 'passfile', 'sslcert', 'sslkey', 'sslrootcert', 'options',
]);
const FIXTURE_ENVS = {
    admin: 'PROFILE_AUTHORITY_EXPAND_ADMIN_PROFILE_ID',
    franchise: 'PROFILE_AUTHORITY_EXPAND_FRANCHISE_PROFILE_ID',
    target: 'PROFILE_AUTHORITY_EXPAND_TARGET_PROFILE_ID',
};
const TEAM_VS_AUTHORITY_REQUEST_ID = '41000000-0000-4000-8000-000000000001';
const SAME_REQUEST_ID = '41000000-0000-4000-8000-000000000002';

function refuse(message) {
    console.error(`[profile-authority-expand-concurrency] Refusing to run: ${message}`);
    process.exit(1);
}

if (process.env[OPT_IN_ENV] !== '1') refuse(`set ${OPT_IN_ENV}=1 explicitly`);

const databaseUrl = process.env[DATABASE_URL_ENV];
if (!databaseUrl) refuse(`set an explicit staging database URL in ${DATABASE_URL_ENV}`);

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
        refuse('sslmode must be require or verify-full');
    }
}

const requestedSslMode = parsedDatabaseUrl.searchParams.get('sslmode')?.toLowerCase() || 'require';
const hostname = parsedDatabaseUrl.hostname.toLowerCase();
const username = decodeURIComponent(parsedDatabaseUrl.username).toLowerCase();
if (`${hostname}/${username}`.includes(PRODUCTION_REF)) {
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
    for (const [name, envName] of Object.entries(FIXTURE_ENVS)) {
        const value = process.env[envName];
        if (!value) refuse(`set ${envName} to an explicit staging profile UUID`);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
            refuse(`${envName} is not a valid UUID`);
        }
        fixtures[name] = value;
    }
    if (new Set(Object.values(fixtures)).size !== Object.keys(fixtures).length) {
        refuse('admin, franchise and target fixture UUIDs must be distinct');
    }
    return fixtures;
}

function loadNodePostgresFromNodePath() {
    const configuredNodePath = process.env.NODE_PATH;
    if (!configuredNodePath) refuse('NODE_PATH must point to the temporary node-postgres node_modules');
    const nodePathRoots = configuredNodePath.split(delimiter).filter(Boolean).map((entry) => resolve(entry));
    if (nodePathRoots.length === 0) refuse('NODE_PATH has no usable module roots');

    const requireFromNodePath = createRequire(import.meta.url);
    let resolvedPgPath;
    try {
        resolvedPgPath = requireFromNodePath.resolve('pg');
    } catch {
        refuse('node-postgres is not resolvable from NODE_PATH');
    }
    const loadedFromApprovedRoot = nodePathRoots.some((root) => {
        const pathFromRoot = relative(root, resolvedPgPath);
        return pathFromRoot === '' || (
            pathFromRoot !== '..'
            && !pathFromRoot.startsWith(`..${sep}`)
            && !isAbsolute(pathFromRoot)
        );
    });
    if (!loadedFromApprovedRoot) refuse('node-postgres resolved outside NODE_PATH');

    const nodePostgres = requireFromNodePath('pg');
    if (typeof nodePostgres.Client !== 'function') refuse('NODE_PATH pg module has no Client export');
    return nodePostgres.Client;
}

const fixtures = readFixtureUuids();
const actorId = `'${fixtures.admin}'::uuid`;
const franchiseProfileId = `'${fixtures.franchise}'::uuid`;
const targetId = `'${fixtures.target}'::uuid`;
const sanitizedDatabaseUrl = new URL(parsedDatabaseUrl);
sanitizedDatabaseUrl.search = '';
const Client = loadNodePostgresFromNodePath();
const sharedClientConfig = {
    connectionString: sanitizedDatabaseUrl.toString(),
    ssl: { rejectUnauthorized: requestedSslMode === 'verify-full' },
    connectionTimeoutMillis: 10_000,
    application_name: 'zinergia-profile-authority-expand-concurrency',
};
const owner = new Client(sharedClientConfig);
const contender = new Client(sharedClientConfig);
const catalogTlsEvidenceSql = isApprovedDirectHost
    ? `NOT EXISTS (
           SELECT 1
           FROM pg_catalog.pg_stat_ssl ssl_state
           WHERE ssl_state.pid = pg_backend_pid()
             AND ssl_state.ssl IS TRUE
       )`
    : 'FALSE';

const sessionPreflightSql = `
SET LOCAL ROLE service_role;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '8s';
DO $profile_authority_expand_concurrency_preflight$
DECLARE
    v_actor public.profiles%ROWTYPE;
    v_target public.profiles%ROWTYPE;
    v_franchise public.profiles%ROWTYPE;
BEGIN
    IF current_database() IS DISTINCT FROM '${expectedDatabase}'
       OR current_user IS NULL
       OR inet_server_addr() IS NULL
       OR ${catalogTlsEvidenceSql} THEN
        RAISE EXCEPTION 'staging connection preflight failed';
    END IF;

    SELECT * INTO v_actor FROM public.profiles WHERE id = ${actorId};
    SELECT * INTO v_target FROM public.profiles WHERE id = ${targetId};
    SELECT * INTO v_franchise FROM public.profiles WHERE id = ${franchiseProfileId};
    IF v_actor.id IS NULL
       OR v_actor.role IS DISTINCT FROM 'admin'
       OR v_actor.parent_id IS NOT NULL
       OR v_actor.franchise_id IS NOT NULL THEN
        RAISE EXCEPTION 'canonical Admin fixture invalid';
    END IF;
    IF v_target.id IS NULL
       OR v_target.role IS NOT NULL
       OR v_target.parent_id IS NOT NULL
       OR v_target.franchise_id IS NOT NULL THEN
        RAISE EXCEPTION 'synthetic target is not neutral';
    END IF;
    IF v_franchise.id IS NULL OR v_franchise.franchise_id IS NULL
       OR NOT EXISTS (
           SELECT 1 FROM public.franchises f
           WHERE f.id = v_franchise.franchise_id
             AND f.is_active IS TRUE
       ) THEN
        RAISE EXCEPTION 'active franchise fixture invalid';
    END IF;
END
$profile_authority_expand_concurrency_preflight$;
`;

function ownerAuthorityProbeSql(requestId, repeatSameRequest) {
    const secondCall = repeatSameRequest ? `
    v_second := public.change_profile_authority(
        ${actorId}, ${targetId}, 'agent', ${actorId}, v_franchise_id,
        v_target.authority_version, 'authority_correction', '${requestId}'::uuid
    );
    IF v_first->>'event_id' IS DISTINCT FROM v_second->>'event_id' THEN
        RAISE EXCEPTION 'same request did not return stable event evidence';
    END IF;
` : '';
    return `
SELECT pg_advisory_xact_lock(hashtextextended('profile-authority-canonical', 0));
SAVEPOINT authority_probe;
DO $authority_probe$
DECLARE
    v_target public.profiles%ROWTYPE;
    v_franchise_id uuid;
    v_first jsonb;
    v_second jsonb;
BEGIN
    SELECT * INTO v_target FROM public.profiles WHERE id = ${targetId};
    SELECT p.franchise_id INTO v_franchise_id
    FROM public.profiles p WHERE p.id = ${franchiseProfileId};
    v_first := public.change_profile_authority(
        ${actorId}, ${targetId}, 'agent', ${actorId}, v_franchise_id,
        v_target.authority_version, 'authority_correction', '${requestId}'::uuid
    );
    ${secondCall}
END
$authority_probe$;
ROLLBACK TO SAVEPOINT authority_probe;
`;
}

const blockedTeamProbeSql = `
DO $TEAM_VS_AUTHORITY_blocked_team$
DECLARE v_blocked boolean := false;
BEGIN
    BEGIN
        PERFORM public.update_team_member_name(
            ${actorId}, ${targetId}, 'Concurrency Verify Team Name'
        );
    EXCEPTION WHEN lock_not_available THEN
        v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'team call bypassed the canonical global lock';
    END IF;
END
$TEAM_VS_AUTHORITY_blocked_team$;
`;

const blockedSameRequestProbeSql = `
DO $SAME_REQUEST_blocked_authority$
DECLARE
    v_target public.profiles%ROWTYPE;
    v_franchise_id uuid;
    v_blocked boolean := false;
BEGIN
    SELECT * INTO v_target FROM public.profiles WHERE id = ${targetId};
    SELECT p.franchise_id INTO v_franchise_id
    FROM public.profiles p WHERE p.id = ${franchiseProfileId};
    BEGIN
        PERFORM public.change_profile_authority(
            ${actorId}, ${targetId}, 'agent', ${actorId}, v_franchise_id,
            v_target.authority_version, 'authority_correction', '${SAME_REQUEST_ID}'::uuid
        );
    EXCEPTION WHEN lock_not_available THEN
        v_blocked := true;
    END;
    IF NOT v_blocked THEN
        RAISE EXCEPTION 'same request contender bypassed the canonical global lock (55P03)';
    END IF;
END
$SAME_REQUEST_blocked_authority$;
`;

async function beginVerifiedSession(client) {
    if (client.connection?.stream?.encrypted !== true) {
        throw new Error('staging client TLS preflight failed');
    }
    await client.query('BEGIN;');
    await client.query(sessionPreflightSql);
}

async function rollbackSession(client) {
    try {
        await client.query('ROLLBACK;');
    } catch {
        // A failed connection has no transaction to preserve; end() still runs below.
    }
}

async function runTeamVsAuthority() {
    await beginVerifiedSession(owner);
    await owner.query(ownerAuthorityProbeSql(TEAM_VS_AUTHORITY_REQUEST_ID, false));
    await beginVerifiedSession(contender);
    await contender.query(blockedTeamProbeSql);
    await contender.query('ROLLBACK;');
    await owner.query('ROLLBACK;');
}

async function runSameRequestRace() {
    await beginVerifiedSession(owner);
    await owner.query(ownerAuthorityProbeSql(SAME_REQUEST_ID, true));
    await beginVerifiedSession(contender);
    await contender.query(blockedSameRequestProbeSql);
    await contender.query('ROLLBACK;');
    await owner.query('ROLLBACK;');
}

let ownerConnected = false;
let contenderConnected = false;
try {
    await owner.connect();
    ownerConnected = true;
    await contender.connect();
    contenderConnected = true;
    await runTeamVsAuthority();
    await runSameRequestRace();
} finally {
    if (contenderConnected) await rollbackSession(contender);
    if (ownerConnected) await rollbackSession(owner);
    if (contenderConnected) await contender.end();
    if (ownerConnected) await owner.end();
}

console.log(
    '[profile-authority-expand-concurrency] node-postgres staging verification passed; '
    + 'both sessions rolled back and no Auth Admin operation was attempted',
);
