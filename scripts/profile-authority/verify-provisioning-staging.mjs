#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const STAGING_REF = 'dnzytocmtmnptndeczny';
const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm';
const OPT_IN = 'PROFILE_AUTHORITY_ALLOW_STAGING_PROVISIONING_VERIFY';
const ENV_FILE = '.env.staging.local';

function refuse(message) {
    throw new Error(`[profile-authority-provisioning] Refusing to run: ${message}`);
}

if (process.env[OPT_IN] !== '1') refuse(`set ${OPT_IN}=1 explicitly`);
if (!existsSync(ENV_FILE)) refuse(`missing ${ENV_FILE}`);
config({ path: ENV_FILE, quiet: true });

const apiUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env['SUPABASE_' + 'SERVICE_ROLE_KEY'];
const password = process.env.STAGING_DB_PASSWORD;
if (!apiUrl || !serviceKey || !password) refuse('staging API, service key or database password is absent');

const parsedApiUrl = new URL(apiUrl);
const projectRef = parsedApiUrl.hostname.split('.')[0];
if (parsedApiUrl.protocol !== 'https:' || projectRef !== STAGING_REF || apiUrl.includes(PRODUCTION_REF)) {
    refuse('target is not the approved TLS staging project');
}

const databaseUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-1-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`;
const service = createClient(apiUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});
const marker = `profile-authority-provisioning-${randomUUID()}`;
const email = `profile-authority-provisioning-${randomUUID()}@example.invalid`;
const fixturePassword = `Z!${randomBytes(24).toString('base64url')}`;
let fixtureId = null;

function sqlLiteral(value) {
    return `'${value.replaceAll("'", "''")}'`;
}

async function waitForNeutralProfile(id) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        const result = await service.from('profiles')
            .select('id,role,parent_id,franchise_id')
            .eq('id', id)
            .maybeSingle();
        if (result.error) throw new Error('neutral profile lookup failed');
        if (result.data) {
            if (result.data.role !== null || result.data.parent_id !== null || result.data.franchise_id !== null) {
                throw new Error('Auth bootstrap did not create a neutral fixture');
            }
            return;
        }
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error('neutral profile was not created before timeout');
}

async function canonicalTopology() {
    const result = await service.from('profiles').select('id,role,parent_id,franchise_id');
    if (result.error) throw new Error('staging topology lookup failed');
    const rows = result.data ?? [];
    const admin = rows.find((row) => row.role === 'admin' && row.parent_id === null && row.franchise_id === null);
    const franchise = rows.find((row) => row.role === 'franchise' && row.parent_id === admin?.id && row.franchise_id !== null);
    if (!admin || !franchise || !franchise.franchise_id) throw new Error('canonical Admin/Franchise fixture is absent');
    return { adminId: admin.id, franchiseId: franchise.id, networkId: franchise.franchise_id };
}

function resolvePsql() {
    const candidate = 'C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe';
    return existsSync(candidate) ? candidate : 'psql.exe';
}

function executeRollbackOnlySql(topology) {
    const invitationId = randomUUID();
    const requestId = randomUUID();
    const code = `verify-${randomUUID().replaceAll('-', '')}`;
    const sourceHash = randomBytes(32).toString('hex');
    const identityHash = randomBytes(32).toString('hex');
    const payloadHash = randomBytes(32).toString('hex');
    const sql = `
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';
SET LOCAL ROLE service_role;
DO \$profile_authority_provisioning_verify\$
DECLARE
    v_receipt_id uuid;
    v_provisioning_id uuid;
    v_result jsonb;
    v_event_id uuid;
BEGIN
    INSERT INTO public.network_invitations (id, creator_id, email, role, code, used, expires_at, target_franchise_id)
    VALUES (${sqlLiteral(invitationId)}::uuid, ${sqlLiteral(topology.franchiseId)}::uuid,
        ${sqlLiteral(email)}, 'agent', ${sqlLiteral(code)}, false, now() + interval '15 minutes', NULL);

    v_result := public.consume_profile_join_rate_limit(${sqlLiteral(sourceHash)}, ${sqlLiteral(identityHash)});
    v_receipt_id := (v_result->>'receipt_id')::uuid;
    IF v_result->>'allowed' IS DISTINCT FROM 'true' OR v_receipt_id IS NULL THEN
        RAISE EXCEPTION 'RATE_RECEIPT_NOT_ISSUED';
    END IF;
    PERFORM public.claim_profile_join_rate_limit_receipt(v_receipt_id, ${sqlLiteral(invitationId)}::uuid,
        ${sqlLiteral(requestId)}::uuid, ${sqlLiteral(payloadHash)});
    v_result := public.begin_profile_invitation_provisioning(${sqlLiteral(invitationId)}::uuid,
        ${sqlLiteral(email)}, ${sqlLiteral(requestId)}::uuid, v_receipt_id, ${sqlLiteral(payloadHash)});
    v_provisioning_id := (v_result->>'provisioning_id')::uuid;
    IF v_result->>'status' IS DISTINCT FROM 'prepared' OR v_provisioning_id IS NULL THEN
        RAISE EXCEPTION 'PROVISIONING_NOT_PREPARED';
    END IF;
    PERFORM public.record_profile_invitation_auth_user(v_provisioning_id, ${sqlLiteral(fixtureId)}::uuid,
        now() + interval '1 hour');
    v_result := public.finalize_profile_invitation_authority(v_provisioning_id, 'Staging Provisioning Fixture', now() + interval '1 hour');
    v_event_id := (v_result->>'event_id')::uuid;
    IF v_result->>'status' IS DISTINCT FROM 'authority_committed' OR v_event_id IS NULL THEN
        RAISE EXCEPTION 'AUTHORITY_NOT_COMMITTED';
    END IF;
    PERFORM public.finalize_profile_invitation_authority(v_provisioning_id, 'Staging Provisioning Fixture', now() + interval '1 hour');
    PERFORM public.complete_profile_invitation_provisioning(v_provisioning_id, ${sqlLiteral(fixtureId)}::uuid, NULL);
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = ${sqlLiteral(fixtureId)}::uuid
        AND role = 'agent' AND parent_id = ${sqlLiteral(topology.franchiseId)}::uuid
        AND franchise_id = ${sqlLiteral(topology.networkId)}::uuid)
       OR (SELECT count(*) FROM public.profile_authority_events WHERE id = v_event_id AND request_id = ${sqlLiteral(requestId)}::uuid) <> 1
       OR NOT EXISTS (SELECT 1 FROM public.network_invitations WHERE id = ${sqlLiteral(invitationId)}::uuid AND used IS TRUE)
       OR NOT EXISTS (SELECT 1 FROM public.profile_invitation_provisioning WHERE id = v_provisioning_id AND status = 'completed') THEN
        RAISE EXCEPTION 'PROVISIONING_CONTRACT_FAILED';
    END IF;
END
\$profile_authority_provisioning_verify\$;
ROLLBACK;
SELECT 'ok' AS profile_authority_provisioning_verification;
`;
    const temp = join(tmpdir(), `zinergia-profile-authority-provisioning-${randomUUID()}.sql`);
    writeFileSync(temp, sql, { encoding: 'utf8' });
    try {
        const result = spawnSync(resolvePsql(), ['--no-psqlrc', '--set', 'ON_ERROR_STOP=1', '--dbname', databaseUrl, '--file', temp], {
            stdio: 'inherit', shell: false, env: { ...process.env, PGCONNECT_TIMEOUT: '10' },
        });
        if (result.status !== 0) throw new Error('rollback-only provisioning verifier failed');
    } finally {
        rmSync(temp, { force: true });
    }
}

function executeConcurrencyRollback(topology) {
    const runner = 'scripts/profile-authority/verify-expand-concurrency-staging.mjs';
    const result = spawnSync(process.execPath, [runner], {
        cwd: process.cwd(),
        stdio: 'inherit',
        shell: false,
        env: {
            ...process.env,
            NODE_PATH: join(process.cwd(), 'node_modules'),
            PROFILE_AUTHORITY_EXPAND_ALLOW_STAGING_CONCURRENCY_VERIFY: '1',
            PROFILE_AUTHORITY_EXPAND_STAGING_DB_URL: databaseUrl,
            PROFILE_AUTHORITY_EXPAND_ADMIN_PROFILE_ID: topology.adminId,
            PROFILE_AUTHORITY_EXPAND_FRANCHISE_PROFILE_ID: topology.franchiseId,
            PROFILE_AUTHORITY_EXPAND_TARGET_PROFILE_ID: fixtureId,
        },
    });
    if (result.status !== 0) throw new Error('two-session concurrency verifier failed');
}

async function assertAndDeleteFixture() {
    if (!fixtureId) return;
    const userResult = await service.auth.admin.getUserById(fixtureId);
    const user = userResult.data?.user;
    if (userResult.error || !user || user.app_metadata?.zinergia_fixture !== marker) {
        throw new Error('fixture ownership cannot be proven before cleanup');
    }
    const references = await Promise.all([
        service.from('profile_authority_events').select('id', { count: 'exact', head: true }).or(`actor_id.eq.${fixtureId},target_profile_id.eq.${fixtureId}`),
        service.from('profile_invitation_provisioning').select('id', { count: 'exact', head: true }).eq('auth_user_id', fixtureId),
    ]);
    if (references.some((result) => result.error || result.count !== 0)) throw new Error('rollback left a fixture reference');
    const deleted = await service.auth.admin.deleteUser(fixtureId, false);
    if (deleted.error) throw new Error('fixture cleanup failed');
    const profileAfter = await service.from('profiles').select('id').eq('id', fixtureId).maybeSingle();
    if (profileAfter.error || profileAfter.data) throw new Error('fixture profile remains after cleanup');
}

let failure = null;
try {
    const created = await service.auth.admin.createUser({
        email, password: fixturePassword, email_confirm: true, ban_duration: '87600h',
        app_metadata: { zinergia_fixture: marker, zinergia_fixture_purpose: 'post_contract_provisioning' },
    });
    if (created.error || !created.data.user) throw new Error('blocked Auth fixture creation failed');
    fixtureId = created.data.user.id;
    if (created.data.user.app_metadata?.zinergia_fixture !== marker || !(Date.parse(created.data.user.banned_until || '') > Date.now())) {
        throw new Error('fixture must be owned and blocked');
    }
    await waitForNeutralProfile(fixtureId);
    const topology = await canonicalTopology();
    executeConcurrencyRollback(topology);
    executeRollbackOnlySql(topology);
} catch (error) {
    failure = error;
} finally {
    try { await assertAndDeleteFixture(); } catch (cleanupError) { failure ??= cleanupError; }
}

if (failure) throw failure;
console.log('STAGING_PROVISIONING_TRANSACTIONAL_OK rollback=true cleanup=true production=false');
