#!/usr/bin/env node
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const STAGING_REF = 'dnzytocmtmnptndeczny';
const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm';
const apiUrl = process.env.PROFILE_AUTHORITY_AUTH_STAGING_URL;
const anonKey = process.env.PROFILE_AUTHORITY_AUTH_STAGING_ANON_KEY;
const adminKey = process.env.PROFILE_AUTHORITY_AUTH_STAGING_ADMIN_KEY;

function refuse(message) {
    throw new Error(`Refusing blocked-Auth verification: ${message}`);
}

if (!apiUrl || !anonKey || !adminKey) refuse('staging credentials are missing');
const parsedUrl = new URL(apiUrl);
if (parsedUrl.hostname.includes(PRODUCTION_REF)) refuse('API URL identifies production');
if (!parsedUrl.hostname.includes(STAGING_REF)) refuse('API URL is not approved staging');
if (parsedUrl.protocol !== 'https:') refuse('API TLS is absent');

const marker = `profile-authority-blocked-${randomUUID()}`;
const email = `profile-authority-${randomUUID()}@example.test`;
const password = `${randomBytes(24).toString('base64url')}aA7!`;
const service = createClient(apiUrl, adminKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});
const publicClient = createClient(apiUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
});

let fixtureId = null;
let verificationError = null;

async function assertNoReferences(id) {
    const checks = await Promise.all([
        service.from('profile_authority_events').select('id', { count: 'exact', head: true }).or(`actor_id.eq.${id},target_profile_id.eq.${id}`),
        service.from('profile_invitation_provisioning').select('id', { count: 'exact', head: true }).eq('auth_user_id', id),
        service.from('network_invitations').select('id', { count: 'exact', head: true }).eq('creator_id', id),
    ]);
    if (checks.some((result) => result.error || result.count !== 0)) {
        throw new Error('synthetic Auth fixture has an unexpected domain reference');
    }
}

try {
    const created = await service.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        ban_duration: '87600h',
        app_metadata: {
            zinergia_fixture: marker,
            zinergia_fixture_purpose: 'blocked_auth_verification',
        },
    });
    if (created.error || !created.data.user) throw created.error ?? new Error('Auth user was not created');
    fixtureId = created.data.user.id;
    if (created.data.user.app_metadata?.zinergia_fixture !== marker) {
        throw new Error('synthetic Auth ownership marker is absent');
    }
    if (!(Date.parse(created.data.user.banned_until || '') > Date.now())) {
        throw new Error('synthetic Auth user was not created blocked');
    }

    let profile = null;
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const result = await service
            .from('profiles')
            .select('id, role, parent_id, franchise_id')
            .eq('id', fixtureId)
            .maybeSingle();
        if (result.error) throw result.error;
        profile = result.data;
        if (profile) break;
        await new Promise((resolve) => setTimeout(resolve, 200));
    }
    if (
        !profile
        || profile.role !== null
        || profile.parent_id !== null
        || profile.franchise_id !== null
    ) {
        throw new Error('Auth trigger did not create an exact neutral profile');
    }

    const signIn = await publicClient.auth.signInWithPassword({ email, password });
    if (!signIn.error || signIn.data.session !== null || signIn.data.session?.access_token) {
        throw new Error('blocked Auth user obtained a session or access token');
    }
    await assertNoReferences(fixtureId);
} catch (error) {
    verificationError = error;
} finally {
    let cleanupError = null;
    if (fixtureId) {
        try {
            const current = await service.auth.admin.getUserById(fixtureId);
            if (
                current.error
                || !current.data.user
                || current.data.user.app_metadata?.zinergia_fixture !== marker
            ) {
                throw new Error('fixture ownership could not be proven before cleanup');
            }
            await assertNoReferences(fixtureId);
            const deleted = await service.auth.admin.deleteUser(fixtureId, false);
            if (deleted.error) throw deleted.error;
            const [profileAfter, authAfter] = await Promise.all([
                service.from('profiles').select('id').eq('id', fixtureId).maybeSingle(),
                service.auth.admin.getUserById(fixtureId),
            ]);
            if (profileAfter.error || profileAfter.data || !authAfter.error || authAfter.data.user) {
                throw new Error('fixture cleanup postcondition failed');
            }
        } catch (error) {
            cleanupError = error;
        }
    }
    if (cleanupError) throw cleanupError;
}

if (verificationError) throw verificationError;
console.log('BLOCKED_AUTH_STAGING_OK neutral=true jwt=false cleanup=true production=false');
