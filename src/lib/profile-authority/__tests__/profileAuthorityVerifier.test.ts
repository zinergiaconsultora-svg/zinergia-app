import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationsDir = resolve(root, 'supabase/migrations');
const structurePath = resolve(root, 'supabase/scripts/profile-authority/verify_structure.sql');
const transactionalPath = resolve(root, 'supabase/scripts/profile-authority/verify_transactional.sql');
const runnerPath = resolve(root, 'scripts/profile-authority/verify-staging.mjs');
const fixturesPath = resolve(root, 'scripts/profile-authority/fixtures.json');

const read = (path: string) => readFileSync(path, 'utf8');

describe('ZIN-SDD-041 T3 verifier harness', () => {
    it('defines the complete role, payload and executable Auth crash-window fixtures', () => {
        const fixtures = JSON.parse(read(fixturesPath)) as {
            actors: string[];
            payloads: string[];
            crashWindows: Array<{
                id: string;
                stopAfter: ProvisioningStage;
                expectsAuthUser: boolean;
                expectsBanned: boolean;
                expectsAuthorityCommitted: boolean;
            }>;
        };

        expect(fixtures.actors).toEqual([
            'anon',
            'agent_a',
            'agent_b_same_franchise',
            'agent_other_franchise',
            'franchise',
            'admin_jwt',
            'neutral_profile',
            'provisioning_user_blocked',
            'service_role',
        ]);
        expect(fixtures.payloads).toEqual([
            'benign',
            'protected',
            'mixed',
            'unknown',
        ]);
        expect(fixtures.crashWindows.map(({ id }) => id)).toEqual([
            'before_auth_create',
            'after_blocked_auth_create_before_record',
            'after_record_before_authority_commit',
            'after_authority_commit_before_unban',
            'after_unban_before_response',
        ]);

        for (const scenario of fixtures.crashWindows) {
            const crashed = provisionUntil(scenario.stopAfter);
            expect(crashed.authUsers).toBe(scenario.expectsAuthUser ? 1 : 0);
            expect(crashed.banned).toBe(scenario.expectsBanned);
            expect(crashed.authorityCommitted).toBe(scenario.expectsAuthorityCommitted);
            if (!crashed.authorityCommitted) expect(canIssueJwt(crashed)).toBe(false);

            const converged = reconcile(reconcile(crashed));
            expect(converged).toMatchObject({
                provisioningRows: 1,
                authUsers: 1,
                invitationConsumptions: 1,
                authorityEvents: 1,
                authorityCommitted: true,
                banned: false,
                status: 'completed',
            });
        }
    });

    it('keeps the SQL and staging runners fail-closed and recoverable', () => {
        const structure = read(structurePath);
        const transactional = read(transactionalPath);
        const runner = read(runnerPath);

        expect(structure).toContain('SET TRANSACTION READ ONLY');
        expect(structure).toContain('profile_authority_events');
        expect(structure).toContain('profile_invitation_provisioning');
        expect(structure).toContain('has_column_privilege');
        expect(structure).toContain("grantee = 'PUBLIC'");
        expect(structure).toContain("has_table_privilege('anon'");
        expect(structure).toContain("has_table_privilege('authenticated'");
        expect(structure).toContain("has_table_privilege('service_role'");
        expect(structure).toContain('relrowsecurity');
        expect(structure).toContain('pg_policies');
        expect(structure).toContain('required_rpcs');
        expect(structure).toContain('prosecdef');
        expect(structure).toContain("ARRAY['search_path=\"\"']");
        expect(structure).toContain('auth.users');
        expect(structure).toContain('rate_limit_table');
        expect(structure).toContain('ROLLBACK;');

        expect(transactional).toContain('BEGIN;');
        expect(transactional).toContain('SET LOCAL ROLE service_role');
        expect(transactional).toContain('change_profile_authority');
        expect(transactional).toContain('UPDATE public.profile_authority_events');
        expect(transactional).toContain('DELETE FROM public.profile_authority_events');
        expect(transactional).toContain('TRUNCATE public.profile_authority_events');
        expect(transactional).toContain('__CONFLICT_PARENT_ID__');
        expect(transactional).toContain('ROLLBACK;');
        expect(transactional).not.toContain('COMMIT;');

        expect(runner).toContain("PROFILE_AUTHORITY_ALLOW_STAGING_VERIFY !== '1'");
        expect(runner).toContain("dnzytocmtmnptndeczny");
        expect(runner).toContain("gmjgkzaxmkaggsyczwcm");
        expect(runner).toContain('PROFILE_AUTHORITY_STAGING_DB_URL');
        expect(runner).toContain("'--dbname'");
        expect(runner).toContain('resolvePsqlCommand');
        expect(runner).not.toContain("'--linked'");
        expect(runner).not.toContain('supabase/.temp/project-ref');
        expect(runner).toContain('verify_structure.sql');
        expect(runner).toContain('verify_transactional.sql');
        expect(runner).not.toMatch(/\.from\('profiles'\)\.\s*(?:insert|update|delete)\s*\(/);
        expect(runner).not.toContain('.auth.admin.createUser(');
        expect(runner).not.toContain('.auth.admin.deleteUser(');
        expect(runner).toContain('real Auth lifecycle verification is not implemented');
        expect(runner).toContain('five real Auth crash windows and convergence remain unimplemented');

        for (const label of [
            'Agent own benign UPDATE',
            'Agent own protected UPDATE',
            'Agent own mixed UPDATE',
            'Agent unknown-field UPDATE',
            'authenticated INSERT',
            'authenticated DELETE',
        ]) expect(transactional).toContain(label);
    });

    it('executes the real route and reconciler fault-injection adapters for all five windows', async () => {
        const routePath = resolve(root, 'src/app/api/join/provision/route.ts');
        const reconcilerPath = resolve(root, 'src/app/api/cron/reconcile-invitation-provisioning/route.ts');
        if (!existsSync(routePath) || !existsSync(reconcilerPath)) {
            throw new Error('RED: route/reconciler fault-injection exports are absent');
        }
        const routeModule = await import(routePath) as AuthRouteAdapterModule;
        const reconcilerModule = await import(reconcilerPath) as AuthReconcilerAdapterModule;
        expect(typeof routeModule.createProvisioningFaultInjectionAdapter).toBe('function');
        expect(typeof reconcilerModule.reconcileProvisioningFaultInjectionAdapter).toBe('function');

        const scenarios = (JSON.parse(read(fixturesPath)) as { crashWindows: CrashWindow[] }).crashWindows;
        for (const scenario of scenarios) {
            const adapter = await routeModule.createProvisioningFaultInjectionAdapter();
            try {
                await adapter.runUntilInjectedCrash(scenario.stopAfter);
                const crashed = await adapter.snapshot();
                expect(crashed.authUsers).toBe(scenario.expectsAuthUser ? 1 : 0);
                expect(crashed.banned).toBe(scenario.expectsBanned);
                expect(crashed.authorityCommitted).toBe(scenario.expectsAuthorityCommitted);
                if (!crashed.authorityCommitted) expect(await adapter.canIssueJwt()).toBe(false);

                await adapter.retryRouteWithNewRequestId();
                await reconcilerModule.reconcileProvisioningFaultInjectionAdapter(adapter);
                await reconcilerModule.reconcileProvisioningFaultInjectionAdapter(adapter);
                expect(await adapter.snapshot()).toMatchObject({
                    provisioningRows: 1,
                    authUsers: 1,
                    profileRows: 1,
                    invitationRows: 1,
                    invitationConsumptions: 1,
                    authorityEvents: 1,
                    authorityCommitted: true,
                    banned: false,
                    status: 'completed',
                });
            } finally {
                await adapter.dispose();
                expect(await adapter.snapshot(), `${scenario.id}: cleanup left persistent residue`).toMatchObject({
                    provisioningRows: 0,
                    authUsers: 0,
                    profileRows: 0,
                    invitationRows: 0,
                    invitationConsumptions: 0,
                    authorityEvents: 0,
                });
            }
        }
    });

    it('provides a guarded real HTTP/PostgREST matrix using reusable staging fixtures', () => {
        const runnerPath = resolve(root, 'scripts/profile-authority/verify-contract-http-staging.mjs');
        expect(existsSync(runnerPath)).toBe(true);
        const runner = read(runnerPath);

        expect(runner).toContain("PROFILE_AUTHORITY_ALLOW_STAGING_HTTP_MATRIX !== '1'");
        expect(runner).toContain('dnzytocmtmnptndeczny');
        expect(runner).toContain('gmjgkzaxmkaggsyczwcm');
        expect(runner).toContain('auth.admin.listUsers');
        expect(runner).toContain('auth.admin.updateUserById');
        for (const label of ['admin', 'franchise', 'agent-a', 'agent-b', 'anon']) expect(runner).toContain(label);
        for (const operation of [".select('iban,fiscal_verified,drive_folder_id')", '.update({ full_name:', ".update({ role: 'admin' })", '.insert({', '.delete()']) {
            expect(runner).toContain(operation);
        }
    });

    it('finds exactly one future definition for every expansion and contract primitive', () => {
        const migrationSql = readdirSync(migrationsDir)
            .filter((name) => /^\d+.*\.sql$/.test(name))
            .map((name) => ({ name, sql: read(resolve(migrationsDir, name)) }));

        const definitions = {
            authorityEvents: migrationSql.filter(({ sql }) =>
                /CREATE TABLE(?: IF NOT EXISTS)? public\.profile_authority_events/i.test(sql),
            ).map(({ name }) => name),
            provisioning: migrationSql.filter(({ sql }) =>
                /CREATE TABLE(?: IF NOT EXISTS)? public\.profile_invitation_provisioning/i.test(sql),
            ).map(({ name }) => name),
            authorityVersion: migrationSql.filter(({ sql }) =>
                /ADD COLUMN(?: IF NOT EXISTS)? authority_version/i.test(sql),
            ).map(({ name }) => name),
            neutralBootstrap: migrationSql.filter(({ sql }) => {
                const definition = sql.match(
                    /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*?\$\$;/i,
                )?.[0];
                return Boolean(
                    definition
                    && /INSERT INTO public\.profiles[\s\S]*role/i.test(definition)
                    && /VALUES[\s\S]*NULL/i.test(definition)
                    && !/VALUES[\s\S]*['\"]agent['\"]/i.test(definition),
                );
            }).map(({ name }) => name),
            finalContract: migrationSql.filter(({ sql }) =>
                /REVOKE[\s\S]+(?:INSERT|UPDATE|DELETE)[\s\S]+public\.profiles[\s\S]+authenticated/i.test(sql)
                && /AUTHORITY_CONTEXT_REQUIRED/i.test(sql)
                && /profiles_directory_select/i.test(sql),
            ).map(({ name }) => name),
        };

        expect(definitions, 'RED until the reviewed ZIN-SDD-041 migrations exist once each').toEqual({
            authorityEvents: [expect.stringMatching(/^\d+.*\.sql$/)],
            provisioning: [expect.stringMatching(/^\d+.*\.sql$/)],
            authorityVersion: [expect.stringMatching(/^\d+.*\.sql$/)],
            neutralBootstrap: [expect.stringMatching(/^\d+.*\.sql$/)],
            finalContract: [expect.stringMatching(/^\d+.*\.sql$/)],
        });
    });

    it('does not silently pass when a verifier file is missing', () => {
        for (const path of [structurePath, transactionalPath, runnerPath, fixturesPath]) {
            expect(existsSync(path)).toBe(true);
        }
    });
});

type ProvisioningStage =
    | 'prepared'
    | 'auth_created_unrecorded'
    | 'auth_created_blocked'
    | 'authority_committed'
    | 'unbanned_response_lost';

type ProvisioningModel = {
    provisioningRows: number;
    authUsers: number;
    profileRows?: number;
    invitationRows?: number;
    authUserRecorded: boolean;
    banned: boolean;
    invitationConsumptions: number;
    authorityEvents: number;
    authorityCommitted: boolean;
    status: 'prepared' | 'auth_created_blocked' | 'authority_committed' | 'completed';
};

function provisionUntil(stage: ProvisioningStage): ProvisioningModel {
    const state: ProvisioningModel = {
        provisioningRows: 1,
        authUsers: 0,
        authUserRecorded: false,
        banned: false,
        invitationConsumptions: 0,
        authorityEvents: 0,
        authorityCommitted: false,
        status: 'prepared',
    };
    if (stage === 'prepared') return state;

    state.authUsers = 1;
    state.banned = true;
    if (stage === 'auth_created_unrecorded') return state;

    state.authUserRecorded = true;
    state.status = 'auth_created_blocked';
    if (stage === 'auth_created_blocked') return state;

    state.authorityCommitted = true;
    state.invitationConsumptions = 1;
    state.authorityEvents = 1;
    state.status = 'authority_committed';
    if (stage === 'authority_committed') return state;

    state.banned = false;
    return state;
}

function reconcile(input: ProvisioningModel): ProvisioningModel {
    const state = { ...input };
    if (state.authUsers === 0) {
        state.authUsers = 1;
        state.banned = true;
    }
    if (!state.authUserRecorded) {
        state.authUserRecorded = true;
        state.status = 'auth_created_blocked';
    }
    if (!state.authorityCommitted) {
        state.authorityCommitted = true;
        state.invitationConsumptions = 1;
        state.authorityEvents = 1;
        state.status = 'authority_committed';
    }
    state.banned = false;
    state.status = 'completed';
    return state;
}

function canIssueJwt(state: ProvisioningModel) {
    return state.authUsers === 1 && !state.banned;
}

type CrashWindow = {
    id: string;
    stopAfter: ProvisioningStage;
    expectsAuthUser: boolean;
    expectsBanned: boolean;
    expectsAuthorityCommitted: boolean;
};

type ProvisioningFaultInjectionAdapter = {
    runUntilInjectedCrash(stage: ProvisioningStage): Promise<void>;
    retryRouteWithNewRequestId(): Promise<void>;
    snapshot(): Promise<ProvisioningModel>;
    canIssueJwt(): Promise<boolean>;
    dispose(): Promise<void>;
};

type AuthRouteAdapterModule = {
    createProvisioningFaultInjectionAdapter(): Promise<ProvisioningFaultInjectionAdapter>;
};

type AuthReconcilerAdapterModule = {
    reconcileProvisioningFaultInjectionAdapter(adapter: ProvisioningFaultInjectionAdapter): Promise<void>;
};
