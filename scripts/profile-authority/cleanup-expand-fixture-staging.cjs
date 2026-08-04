#!/usr/bin/env node
const { createClient } = require('@supabase/supabase-js');
const { delimiter, isAbsolute, relative, resolve, sep } = require('node:path');

const STAGING_REF = 'dnzytocmtmnptndeczny';
const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm';

function refuse(message) {
    throw new Error(`Refusing fixture cleanup: ${message}`);
}

function requireStagingUrl(value, kind) {
    if (!value) refuse(`missing ${kind} URL`);
    const url = new URL(value);
    const identity = `${url.hostname}/${decodeURIComponent(url.username)}`.toLowerCase();
    if (identity.includes(PRODUCTION_REF)) refuse(`${kind} URL identifies production`);
    if (!identity.includes(STAGING_REF)) refuse(`${kind} URL does not identify approved staging`);
    return url;
}

function loadPgClient() {
    const roots = (process.env.NODE_PATH || '').split(delimiter).filter(Boolean).map((entry) => resolve(entry));
    if (roots.length === 0) refuse('NODE_PATH is required for the temporary pg client');
    const resolved = require.resolve('pg');
    if (!roots.some((root) => {
        const child = relative(root, resolved);
        return child === '' || (child !== '..' && !child.startsWith(`..${sep}`) && !isAbsolute(child));
    })) refuse('pg resolved outside NODE_PATH');
    return require('pg').Client;
}

const databaseUrl = requireStagingUrl(
    process.env.PROFILE_AUTHORITY_EXPAND_STAGING_DB_URL,
    'database',
);
const apiUrl = requireStagingUrl(
    process.env.PROFILE_AUTHORITY_EXPAND_STAGING_API_URL,
    'API',
);
const adminKey = process.env.PROFILE_AUTHORITY_EXPAND_STAGING_ADMIN_KEY;
const fixtureId = process.env.PROFILE_AUTHORITY_EXPAND_FIXTURE_ID;
const fixtureMarker = process.env.PROFILE_AUTHORITY_EXPAND_FIXTURE_MARKER;

if (!adminKey || !fixtureMarker) refuse('fixture credentials or ownership marker are missing');
if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(fixtureId || '')) {
    refuse('fixture id is not a UUID');
}

const sslmode = databaseUrl.searchParams.get('sslmode');
if (!['require', 'verify-full'].includes(sslmode)) refuse('database TLS is not mandatory');
databaseUrl.search = '';

const Client = loadPgClient();
const db = new Client({
    connectionString: databaseUrl.toString(),
    ssl: { rejectUnauthorized: sslmode === 'verify-full' },
    connectionTimeoutMillis: 10_000,
    application_name: 'zinergia-profile-authority-fixture-cleanup',
});
const supabase = createClient(apiUrl.toString(), adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const referenceScan = `
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
DO $fixture_cleanup$
DECLARE
    v_constraint record;
    v_count bigint;
    v_id constant uuid := '${fixtureId}'::uuid;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_id AND role IS NULL AND parent_id IS NULL AND franchise_id IS NULL
    ) THEN
        RAISE EXCEPTION 'FIXTURE_NOT_NEUTRAL';
    END IF;

    FOR v_constraint IN
        SELECT namespace.nspname AS schema_name,
               relation.relname AS table_name,
               attribute.attname AS column_name
        FROM pg_constraint foreign_key
        JOIN pg_class relation ON relation.oid = foreign_key.conrelid
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        JOIN LATERAL unnest(foreign_key.conkey) WITH ORDINALITY source_key(attnum, ordinality)
          ON true
        JOIN LATERAL unnest(foreign_key.confkey) WITH ORDINALITY target_key(attnum, ordinality)
          ON target_key.ordinality = source_key.ordinality
        JOIN pg_attribute attribute
          ON attribute.attrelid = foreign_key.conrelid AND attribute.attnum = source_key.attnum
        JOIN pg_attribute target_attribute
          ON target_attribute.attrelid = foreign_key.confrelid AND target_attribute.attnum = target_key.attnum
        WHERE foreign_key.contype = 'f'
          AND foreign_key.confrelid = 'public.profiles'::regclass
          AND target_attribute.attname = 'id'
    LOOP
        EXECUTE format(
            'SELECT count(*) FROM %I.%I WHERE %I = $1',
            v_constraint.schema_name,
            v_constraint.table_name,
            v_constraint.column_name
        ) INTO v_count USING v_id;
        IF v_count <> 0 THEN
            RAISE EXCEPTION 'FIXTURE_DOMAIN_REFERENCE_PRESENT';
        END IF;
    END LOOP;

    IF EXISTS (
        SELECT 1 FROM public.profile_authority_events
        WHERE actor_id = v_id OR target_profile_id = v_id
    ) OR EXISTS (
        SELECT 1 FROM public.profile_invitation_provisioning
        WHERE auth_user_id = v_id
    ) THEN
        RAISE EXCEPTION 'FIXTURE_UNCONSTRAINED_REFERENCE_PRESENT';
    END IF;
END
$fixture_cleanup$;
ROLLBACK;
`;

(async () => {
    try {
        await db.connect();
        if (db.connection?.stream?.encrypted !== true) refuse('database client TLS is absent');

        const authResult = await supabase.auth.admin.getUserById(fixtureId);
        const user = authResult.data?.user;
        if (authResult.error || !user) refuse('fixture Auth user is absent');
        if (user.app_metadata?.zinergia_fixture !== fixtureMarker) refuse('fixture ownership marker differs');
        if (!(Date.parse(user.banned_until || '') > Date.now())) refuse('fixture is not currently blocked');

        await db.query(referenceScan);

        const deleted = await supabase.auth.admin.deleteUser(fixtureId, false);
        if (deleted.error) throw deleted.error;

        const profile = await supabase.from('profiles').select('id').eq('id', fixtureId).maybeSingle();
        if (profile.error || profile.data) throw new Error('fixture profile still exists');
        const authAfter = await supabase.auth.admin.getUserById(fixtureId);
        if (!authAfter.error || authAfter.data?.user) throw new Error('fixture Auth user still exists');

        console.log('[profile-authority-expand] fixture cleanup passed; zero domain references and Auth/profile absent');
    } finally {
        await db.end();
    }
})().catch((error) => {
    console.error(`[profile-authority-expand] fixture cleanup failed: ${error.message}`);
    process.exit(1);
});
