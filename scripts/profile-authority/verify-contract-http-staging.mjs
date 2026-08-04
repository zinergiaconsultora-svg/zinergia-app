#!/usr/bin/env node
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';

const STAGING_REF = 'dnzytocmtmnptndeczny';
const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm';
const refuse = (message) => { console.error(`[profile-authority-http] Refusing to run: ${message}`); process.exit(1); };

if (process.env.PROFILE_AUTHORITY_ALLOW_STAGING_HTTP_MATRIX !== '1') refuse('set PROFILE_AUTHORITY_ALLOW_STAGING_HTTP_MATRIX=1 explicitly');
config({ path: '.env.staging.local', quiet: true });
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env['SUPABASE_' + 'SERVICE_ROLE_KEY'];
if (!url || !anonKey || !serviceRoleKey) refuse('staging credentials are absent');
const ref = new URL(url).hostname.split('.')[0];
if (ref !== STAGING_REF || ref === PRODUCTION_REF) refuse('target is not the approved staging project');

const service = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const sessionClient = () => createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

async function signIn(email, password) {
    const client = sessionClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.user || !data.session) throw new Error('fixture sign-in failed');
    return { client, id: data.user.id };
}

async function fixtureUsers() {
    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error('fixture discovery failed');
    const groups = new Map();
    for (const user of data.users) {
        const marker = user.app_metadata?.zinergia_test_fixture;
        const role = user.app_metadata?.fixture_role;
        if (typeof marker !== 'string' || typeof role !== 'string') continue;
        const group = groups.get(marker) ?? new Map();
        group.set(role, user);
        groups.set(marker, group);
    }
    const complete = [...groups.entries()]
        .filter(([, group]) => ['franchise', 'agent-a', 'agent-b'].every((role) => group.has(role)))
        .sort(([left], [right]) => right.localeCompare(left))[0]?.[1];
    if (!complete) throw new Error('complete staging fixture set is absent');
    return { franchise: complete.get('franchise'), agentA: complete.get('agent-a'), agentB: complete.get('agent-b') };
}

async function resetFixturePassword(user, password) {
    const { error } = await service.auth.admin.updateUserById(user.id, { password });
    if (error) throw new Error('fixture password reset failed');
    return signIn(user.email, password);
}

const assert = (condition, message) => { if (!condition) throw new Error(message); };
async function visibleIds(actor, ids) {
    const { data, error } = await actor.client.from('profiles').select('id').in('id', ids);
    if (error) throw new Error('directory read failed');
    return new Set((data ?? []).map((row) => row.id));
}
const expectDenied = async (result, message) => { if (!result.error) throw new Error(message); };

const password = `Z!${randomBytes(24).toString('base64url')}`;
const [admin, otherAgent, fixtures] = await Promise.all([
    signIn(process.env.E2E_ADMIN_EMAIL, process.env.E2E_ADMIN_PASSWORD),
    signIn(process.env.E2E_AGENT_EMAIL, process.env.E2E_AGENT_PASSWORD),
    fixtureUsers(),
]);
const [franchise, agentA, agentB] = await Promise.all([
    resetFixturePassword(fixtures.franchise, password),
    resetFixturePassword(fixtures.agentA, password),
    resetFixturePassword(fixtures.agentB, password),
]);
const ids = [admin.id, otherAgent.id, franchise.id, agentA.id, agentB.id];
const adminVisible = await visibleIds(admin, ids);
assert(ids.every((id) => adminVisible.has(id)), 'Admin row scope is invalid');
const franchiseVisible = await visibleIds(franchise, ids);
assert([franchise.id, agentA.id, agentB.id].every((id) => franchiseVisible.has(id)), 'Franchise misses its network');
assert(!franchiseVisible.has(otherAgent.id), 'Franchise sees another network');
const agentVisible = await visibleIds(agentA, ids);
assert(agentVisible.has(agentA.id) && agentVisible.has(franchise.id), 'Agent misses self or parent');
assert(!agentVisible.has(agentB.id) && !agentVisible.has(otherAgent.id), 'Agent sees a peer or another network');
for (const actor of [admin, otherAgent, franchise, agentA, agentB]) {
    await expectDenied(await actor.client.from('profiles').select('iban,fiscal_verified,drive_folder_id').eq('id', actor.id), 'protected profile columns are directly readable');
    await expectDenied(await actor.client.from('profiles').update({ full_name: 'must-not-persist' }).eq('id', actor.id), 'direct profile update succeeded');
    await expectDenied(await actor.client.from('profiles').update({ role: 'admin' }).eq('id', actor.id), 'direct authority update succeeded');
}
await expectDenied(await agentA.client.from('profiles').insert({ id: randomUUID(), email: 'profile-write-denied@example.invalid', full_name: 'Denied', role: 'agent' }), 'authenticated profile insert succeeded');
await expectDenied(await agentA.client.from('profiles').delete().eq('id', agentA.id), 'authenticated profile delete succeeded');
await expectDenied(await sessionClient().from('profiles').select('id').in('id', ids), 'anonymous profile read succeeded');
console.log('PROFILE_AUTHORITY_HTTP_MATRIX_OK roles=admin,franchise,agent_same,agent_other,anon production=false');
