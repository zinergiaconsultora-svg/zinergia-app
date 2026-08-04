import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const structurePath = resolve(
    process.cwd(),
    'supabase/scripts/profile-authority/verify_expand_structure.sql',
);
const transactionalPath = resolve(
    process.cwd(),
    'supabase/scripts/profile-authority/verify_expand_transactional.sql',
);
const runnerPath = resolve(
    process.cwd(),
    'scripts/profile-authority/verify-expand-staging.mjs',
);
const concurrencyRunnerPath = resolve(
    process.cwd(),
    'scripts/profile-authority/verify-expand-concurrency-staging.mjs',
);

function readIfPresent(path: string) {
    return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const structure = readIfPresent(structurePath);
const transactional = readIfPresent(transactionalPath);
const runner = readIfPresent(runnerPath);
const concurrencyRunner = readIfPresent(concurrencyRunnerPath);

function withoutSqlCommentsAndStrings(sql: string) {
    return sql
        .replace(/--[^\r\n]*/g, '')
        .replace(/'(?:''|[^'])*'/g, "''");
}

function maskSqlSegment(segment: string) {
    return segment.replace(/[^\r\n]/g, ' ');
}

function topLevelControlSql(sql: string) {
    return sql
        .replace(/^\uFEFF/, '')
        .replace(/\$([a-z_][a-z0-9_]*)?\$[\s\S]*?\$\1\$/gi, maskSqlSegment)
        .replace(/\/\*[\s\S]*?\*\//g, maskSqlSegment)
        .replace(/--[^\r\n]*/g, maskSqlSegment)
        .replace(/'(?:''|[^'])*'/g, maskSqlSegment)
        .replace(/"(?:""|[^"])*"/g, maskSqlSegment);
}

function expectUnconditionalRollback(sql: string) {
    const topLevel = topLevelControlSql(sql);
    const beginStatements = [...topLevel.matchAll(/\bBEGIN\s*;/gi)];
    const rollbackStatements = [...topLevel.matchAll(/\bROLLBACK\s*;/gi)];
    expect(beginStatements).toHaveLength(1);
    expect(rollbackStatements).toHaveLength(1);
    expect(topLevel.match(/\bCOMMIT\s*;/gi) ?? []).toHaveLength(0);
    expect(topLevel.trimStart()).toMatch(/^BEGIN\s*;/i);

    const beginIndex = beginStatements[0].index ?? -1;
    const rollbackIndex = rollbackStatements[0].index ?? -1;
    expect(rollbackIndex).toBeGreaterThan(beginIndex);
    const afterRollback = withoutSqlCommentsAndStrings(sql.slice(
        rollbackIndex + rollbackStatements[0][0].length,
    ));
    expect(afterRollback).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\b/i);
}

function scenarioEndingAt(marker: string) {
    const markerIndex = transactional.indexOf(marker);
    if (markerIndex < 0) return '';

    const commentIndex = transactional.lastIndexOf('\n    --', markerIndex);
    return transactional.slice(Math.max(0, commentIndex), markerIndex + marker.length);
}

describe('ZIN-SDD-041 expand staging verifier contract (RED)', () => {
    it('accepts PostgreSQL canonical DELETE OR UPDATE trigger ordering', () => {
        expect(structure).toMatch(
            /BEFORE \(\?:UPDATE OR DELETE\|DELETE OR UPDATE\)/i,
        );
    });

    it('ships the three explicit expand verification gates', () => {
        expect(existsSync(structurePath), 'missing verify_expand_structure.sql').toBe(true);
        expect(existsSync(transactionalPath), 'missing verify_expand_transactional.sql').toBe(true);
        expect(existsSync(runnerPath), 'missing verify-expand-staging.mjs').toBe(true);
    });

    it('requires explicit staging opt-in and an explicit URL while refusing production and linked execution', () => {
        expect(runner).toMatch(
            /(?:--(?:allow|confirm|verify|run)-staging|PROFILE_AUTHORITY_EXPAND_[A-Z_]*(?:OPT_IN|CONFIRM|ALLOW)[A-Z_]*)/i,
        );
        expect(runner).toMatch(
            /(?:--(?:db-)?url|PROFILE_AUTHORITY_(?:EXPAND_)?STAGING_(?:DB|DATABASE)_URL|STAGING_DATABASE_URL)/i,
        );
        expect(runner).toMatch(/(?:production|\bprod\b)/i);
        expect(runner).toMatch(/(?:refus|reject|throw\s+new\s+Error|process\.exit\s*\(\s*1)/i);
        expect(runner).not.toMatch(/--linked\b/i);
        expect(runner).toContain('verify_expand_structure.sql');
        expect(runner).toContain('verify_expand_transactional.sql');
    });

    it('prevents libpq URL/env target overrides and preflights the same TLS connection', () => {
        expect(runner).toMatch(/for\s*\(\s*const\s+\[name\s*,\s*value\]\s+of\s+parsedDatabaseUrl\.searchParams\s*\)/i);
        for (const forbidden of [
            'host', 'hostaddr', 'service', 'passfile', 'sslcert', 'sslkey', 'sslrootcert', 'options',
        ]) expect(runner).toContain(`'${forbidden}'`);
        expect(runner).toMatch(/normalizedName\s*!==\s*'sslmode'/i);
        expect(runner).toMatch(/\['require'\s*,\s*'verify-full'\]\.includes\s*\(\s*normalizedValue\s*\)/i);
        expect(runner).not.toMatch(/env\s*:\s*\{[\s\S]*?\.\.\.process\.env/i);
        expect(runner).toMatch(/childEnv\.PGDATABASE\s*=\s*databaseUrl/i);
        expect(runner).toMatch(/childEnv\.PGSSLMODE\s*=\s*requestedSslMode/i);
        expect(runner).not.toMatch(/childEnv\.PG(?:HOST|HOSTADDR|SERVICE|SERVICEFILE|PASSFILE|OPTIONS)\s*=/i);

        expect(runner).toMatch(/current_database\s*\(\s*\)/i);
        expect(runner).toMatch(/current_user/i);
        expect(runner).toMatch(/inet_server_addr\s*\(\s*\)/i);
        expect(runner).toMatch(/FROM\s+pg_catalog\.pg_stat_ssl/i);
        expect(runner).toMatch(/pid\s*=\s*pg_backend_pid\s*\(\s*\)/i);
        expect(runner).toMatch(/ssl_state\.ssl\s+IS\s+TRUE/i);
        expect(runner).toMatch(/input\s*:\s*`\$\{connectionPreflightSql\}\\n\$\{sql\}`/i);
    });

    it('injects three validated fixture UUIDs over stdin without leaking values into argv', () => {
        const fixtureContract = {
            __EXPAND_ADMIN_PROFILE_ID__: 'PROFILE_AUTHORITY_EXPAND_ADMIN_PROFILE_ID',
            __EXPAND_FRANCHISE_PROFILE_ID__: 'PROFILE_AUTHORITY_EXPAND_FRANCHISE_PROFILE_ID',
            __EXPAND_TARGET_PROFILE_ID__: 'PROFILE_AUTHORITY_EXPAND_TARGET_PROFILE_ID',
        };
        const transactionalPlaceholders = [...new Set(
            transactional.match(/__EXPAND_[A-Z0-9_]+__/g) ?? [],
        )].sort();
        expect(transactionalPlaceholders).toEqual(Object.keys(fixtureContract).sort());

        for (const [placeholder, envName] of Object.entries(fixtureContract)) {
            expect(runner).toContain(placeholder);
            expect(runner).toContain(envName);
        }
        expect(runner).toMatch(/\^\[0-9a-f\]\{8\}.*\[0-9a-f\]\{12\}\$/i);
        expect(runner).toMatch(/replaceAll\s*\(\s*placeholder\s*,\s*value\s*\)/i);
        expect(runner).toMatch(/__EXPAND_\[A-Z0-9_\]\+__/i);
        expect(runner).toMatch(/\['--no-psqlrc'[^\]]*'--file'\s*,\s*'-'\]/i);
        expect(runner).toMatch(/input\s*:\s*(?:sql|`\$\{connectionPreflightSql\}\\n\$\{sql\}`)/i);
        expect(runner).not.toMatch(/console\.(?:log|error)\s*\([^)]*(?:fixtures?\[|\bvalue\b)/i);
    });

    it('keeps the structural gate read-only and verifies the compatible expand checkpoint', () => {
        const executableSql = withoutSqlCommentsAndStrings(structure);
        expectUnconditionalRollback(structure);
        expect(structure).toMatch(/SET\s+TRANSACTION\s+READ\s+ONLY\s*;/i);
        expect(structure).toMatch(/ROLLBACK\s*;/i);
        expect(structure).not.toMatch(/\bCOMMIT\s*;/i);
        expect(executableSql).not.toMatch(
            /(?:^|;)\s*(?:INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP|CREATE\s+(?:TABLE|INDEX|POLICY|TRIGGER))\b/im,
        );

        for (const required of [
            'authority_version',
            'target_franchise_id',
            'profile_authority_events',
            'profile_invitation_provisioning',
            'profile_join_rate_limit_receipts',
            'profile_authority_guard',
        ]) expect(structure).toContain(required);
        expect(structure).toMatch(/compatib/i);
        expect(structure).toMatch(/(?:pg_proc|information_schema|to_regclass|pg_catalog)/i);
    });

    it('wraps every transactional probe in an unconditional rollback boundary', () => {
        expectUnconditionalRollback(transactional);
        expect(runner).toMatch(/beginStatements\.length\s*!==\s*1/i);
        expect(runner).toMatch(/rollbackStatements\.length\s*!==\s*1/i);
        expect(runner).toMatch(/mutation\s+after\s+its\s+unconditional\s+ROLLBACK/i);
    });

    it('probes receipts, idempotency, cross-domain request ids and expand compatibility', () => {
        expect(transactional).toMatch(/consume_profile_join_rate_limit/i);
        expect(transactional).toMatch(/claim_profile_join_rate_limit_receipt/i);
        expect(transactional).toMatch(/begin_profile_invitation_provisioning/i);
        expect(transactional).toMatch(/profile_join_rate_limit_receipts/i);

        expect(transactional).toMatch(/idempoten/i);
        expect(transactional).toMatch(/change_profile_authority/i);
        expect(transactional).toMatch(/request_id/i);

        expect(transactional).toMatch(/cross[-_ ]domain/i);
        expect(transactional).toMatch(/profile_authority_events/i);
        expect(transactional).toMatch(/profile_invitation_provisioning/i);
        expect(transactional).toMatch(/REQUEST_ID_CONFLICT/i);

        expect(transactional).toMatch(/compatib/i);
        expect(transactional).toMatch(/(?:handle_new_user|update_own_profile|update_team_member_name)/i);
    });

    it('probes regenerated-request resume after authority has already committed', () => {
        const finalization = transactional.search(/public\.finalize_profile_invitation_authority\s*\(/i);
        const postcommit = finalization >= 0 ? transactional.slice(finalization) : '';
        const consume = postcommit.search(/public\.consume_profile_join_rate_limit\s*\(/i);
        const claim = postcommit.search(/public\.claim_profile_join_rate_limit_receipt\s*\(/i);
        const begin = postcommit.search(/public\.begin_profile_invitation_provisioning\s*\(/i);

        expect(consume, 'postcommit retry lacks a new rate attempt').toBeGreaterThanOrEqual(0);
        expect(claim, 'postcommit retry lacks a newly claimed receipt').toBeGreaterThan(consume);
        expect(begin, 'postcommit retry lacks begin resume').toBeGreaterThan(claim);
        expect(postcommit.slice(begin)).toMatch(/'request_id'\s*\)?\s*IS\s+DISTINCT\s+FROM\s+v_provision_request::text/i);
        expect(postcommit.slice(begin)).toMatch(/'provisioning_id'[^;]+v_provisioning_id/i);
        expect(postcommit).toMatch(/POSTCOMMIT[^']*(?:RETRY|RESUME)[^']*(?:FAILED|DID_NOT)/i);
    });

    it('probes completion and verifies the durable completed/unbanned shape', () => {
        expect(transactional).toMatch(/public\.complete_profile_invitation_provisioning\s*\(/i);
        expect(transactional).toMatch(
            /FROM\s+public\.profile_invitation_provisioning[^;]+status\s*=\s*'completed'/i,
        );
        expect(transactional).toMatch(/completed_at\s+IS\s+NOT\s+NULL/i);
        expect(transactional).toMatch(/banned_until\s+IS\s+NULL/i);
        expect(transactional).toMatch(/COMPLETION[^']*(?:FAILED|NOT_DURABLE|STATE)/i);
    });

    it('probes reconciliation lease advancement and prevents immediate reclaim', () => {
        const reconcileCalls = transactional.match(
            /public\.reconcile_profile_invitation_provisioning\s*\(/gi,
        ) ?? [];
        expect(reconcileCalls.length).toBeGreaterThanOrEqual(1);
        expect(transactional).toMatch(/status\s*=\s*'needs_reconciliation'/i);
        expect(transactional).toMatch(
            /updated_at\s*=\s*(?:now\s*\(\s*\)\s*-\s*interval|v_lease_before)/i,
        );
        expect(transactional).toMatch(/last_attempt_at/i);
        expect(transactional).toMatch(/attempt_count/i);
        expect(transactional).toMatch(/RECONCILIATION[^']*(?:LEASE|RECLAIM)[^']*(?:FAILED|ALLOWED|ADVANCED)/i);
    });

    it('proves every permitted invitation authority path and its exact resulting hierarchy', () => {
        const allowedScenarios = [
            {
                name: 'Admin -> Agent',
                marker: 'INVITATION_FINALIZATION_NOT_ATOMIC',
                state: /target\.role\s*=\s*'agent'[\s\S]*?target\.parent_id\s*=\s*v_admin_id[\s\S]*?target\.franchise_id\s*=\s*v_franchise_id/i,
            },
            {
                name: 'Admin -> Franchise',
                marker: 'ADMIN_TO_FRANCHISE_MATRIX_FAILED',
                state: /target\.role\s*=\s*'franchise'[\s\S]*?target\.parent_id\s*=\s*v_admin_id[\s\S]*?target\.franchise_id\s*=\s*v_franchise_id/i,
            },
            {
                name: 'Franchise -> Agent',
                marker: 'FRANCHISE_TO_AGENT_MATRIX_FAILED',
                state: /target\.role\s*=\s*'agent'[\s\S]*?target\.parent_id\s*=\s*v_franchise_profile_id[\s\S]*?target\.franchise_id\s*=\s*v_franchise_id/i,
            },
        ];

        for (const scenario of allowedScenarios) {
            const probe = scenarioEndingAt(scenario.marker);
            expect(probe, `${scenario.name} scenario is missing`).not.toBe('');
            expect(probe, `${scenario.name} does not finalize through the canonical command`).toMatch(
                /public\.finalize_profile_invitation_authority\s*\(/i,
            );
            expect(probe, `${scenario.name} does not prove its final hierarchy`).toMatch(scenario.state);
            expect(probe, `${scenario.name} does not prove immutable event evidence`).toMatch(
                /event_type\s*=\s*'invitation_authority_committed'/i,
            );
        }
    });

    it('fails closed for every forbidden or invalid invitation authority path', () => {
        const deniedScenarios = [
            ['Franchise -> Franchise', 'FRANCHISE_TO_FRANCHISE_MATRIX_ALLOWED', 'INVITATION_AUTHORITY_INVALID'],
            ['inactive target franchise', 'INACTIVE_TARGET_FRANCHISE_MATRIX_ALLOWED', 'INVITATION_AUTHORITY_INVALID'],
            ['expired invitation', 'EXPIRED_INVITATION_MATRIX_ALLOWED', 'INVITATION_INVALID'],
            ['email mismatch', 'EMAIL_MISMATCH_MATRIX_ALLOWED', 'INVITATION_INVALID'],
            ['null-role creator', 'NULL_ROLE_CREATOR_MATRIX_ALLOWED', 'INVITATION_AUTHORITY_INVALID'],
            ['Admin without target_franchise_id', 'ADMIN_MISSING_TARGET_FRANCHISE_MATRIX_ALLOWED', 'INVITATION_AUTHORITY_INVALID'],
        ] as const;

        expect(structure).toMatch(/confrelid\s*=\s*'public\.profiles'::regclass/i);
        expect(structure).toMatch(/FOREIGN KEY\\s\*\\\(creator_id\\\)/i);

        for (const [name, marker, expectedError] of deniedScenarios) {
            const probe = scenarioEndingAt(marker);
            expect.soft(probe, `${name} denial scenario is missing`).not.toBe('');
            if (!probe) continue;

            expect.soft(probe, `${name} does not exercise provisioning begin`).toMatch(
                /public\.begin_profile_invitation_provisioning\s*\(/i,
            );
            expect.soft(probe, `${name} does not require the canonical safe error`).toContain(
                `SQLERRM = '${expectedError}'`,
            );
            expect.soft(probe, `${name} does not fail when denial is absent`).toMatch(/IF\s+NOT\s+v_denied/i);
            expect.soft(probe, `${name} does not prove that provisioning stayed empty`).toMatch(
                /IF\s+NOT\s+v_denied\s+OR\s+EXISTS\s*\([\s\S]*?public\.profile_invitation_provisioning/i,
            );
            expect.soft(probe, `${name} does not prove that the invitation stayed unused`).toMatch(
                /OR\s+EXISTS\s*\([\s\S]*?public\.network_invitations[\s\S]*?used\s+IS\s+TRUE/i,
            );
        }
    });

    it('fails closed unless provisioning, rate attempts and rate receipts start empty', () => {
        const firstFixtureMutation = transactional.search(
            /\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE)\b/i,
        );
        expect(firstFixtureMutation, 'transactional verifier has no rollback-only fixtures').toBeGreaterThan(0);
        const preconditions = transactional.slice(0, firstFixtureMutation);

        for (const table of [
            'profile_invitation_provisioning',
            'profile_join_rate_limits',
            'profile_join_rate_limit_receipts',
        ]) {
            expect(
                preconditions,
                `missing empty-table precondition for ${table}`,
            ).toMatch(new RegExp(`EXISTS\\s*\\(\\s*SELECT\\s+1\\s+FROM\\s+public\\.${table}`, 'i'));
        }
        expect(preconditions).toMatch(/RAISE\s+EXCEPTION\s+'VERIFY_[^']*EMPTY[^']*'/i);
    });

    it('ships a rollback-only two-client node-postgres concurrency harness loaded from NODE_PATH', () => {
        expect(
            existsSync(concurrencyRunnerPath),
            'missing verify-expand-concurrency-staging.mjs',
        ).toBe(true);

        expect(concurrencyRunner).toContain("const STAGING_REF = 'dnzytocmtmnptndeczny'");
        expect(concurrencyRunner).toContain("const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm'");
        expect(concurrencyRunner).toMatch(/PROFILE_AUTHORITY_EXPAND_[A-Z_]*(?:ALLOW|OPT_IN)[A-Z_]*/i);
        expect(concurrencyRunner).toMatch(/PROFILE_AUTHORITY_EXPAND_STAGING_(?:DB|DATABASE)_URL/i);
        expect(concurrencyRunner).toMatch(/new\s+URL\s*\(/i);
        expect(concurrencyRunner).toMatch(/\.pooler\.supabase\.com/i);
        expect(concurrencyRunner).toMatch(/db\.\$\{STAGING_REF\}\.supabase\.co/i);
        expect(concurrencyRunner).toMatch(/pg_catalog\.pg_stat_ssl/i);
        expect(concurrencyRunner).toMatch(/ssl_state\.ssl\s+IS\s+TRUE/i);
        expect(concurrencyRunner).toMatch(/catalogTlsEvidenceSql\s*=\s*isApprovedDirectHost/i);
        expect(concurrencyRunner).toMatch(/connection\?\.stream\?\.encrypted\s*!==\s*true/i);
        for (const forbidden of [
            'host', 'hostaddr', 'service', 'passfile', 'sslcert', 'sslkey', 'sslrootcert', 'options',
        ]) expect(concurrencyRunner).toContain(`'${forbidden}'`);
        expect(concurrencyRunner).not.toMatch(/--linked\b/i);
        expect(concurrencyRunner).not.toMatch(/\bCOMMIT\s*;/i);
        expect(concurrencyRunner).not.toMatch(/auth\.users|auth\.admin|supabase\.auth\.admin/i);

        for (const fixtureEnv of [
            'PROFILE_AUTHORITY_EXPAND_ADMIN_PROFILE_ID',
            'PROFILE_AUTHORITY_EXPAND_FRANCHISE_PROFILE_ID',
            'PROFILE_AUTHORITY_EXPAND_TARGET_PROFILE_ID',
        ]) expect(concurrencyRunner).toContain(fixtureEnv);
        expect(concurrencyRunner).toMatch(/\^\[0-9a-f\]\{8\}.*\[0-9a-f\]\{12\}\$/i);
        expect(concurrencyRunner).toMatch(/must be distinct/i);
        expect(concurrencyRunner).toMatch(/fixtures\.franchise/i);
        expect(concurrencyRunner).toMatch(/v_franchise\.franchise_id/i);

        expect(concurrencyRunner).toMatch(/createRequire\s*\(/i);
        expect(concurrencyRunner).toMatch(/process\.env\.NODE_PATH/i);
        expect(concurrencyRunner).toMatch(/split\s*\(\s*delimiter\s*\)/i);
        expect(concurrencyRunner).toMatch(/\.resolve\s*\(\s*'pg'\s*\)/i);
        expect(concurrencyRunner).toMatch(/requireFromNodePath\s*\(\s*'pg'\s*\)/i);
        expect(concurrencyRunner).toMatch(/relative\s*\(/i);
        expect(concurrencyRunner).not.toMatch(/from\s+['"]pg['"]|import\s*\(\s*['"]pg['"]\s*\)/i);
        expect(concurrencyRunner).not.toMatch(/spawn(?:Sync)?\s*\(|\bpsql(?:\.exe)?\b/i);

        expect(concurrencyRunner).toMatch(/sanitizedDatabaseUrl\.search\s*=\s*''/i);
        expect(concurrencyRunner).toMatch(/connectionString\s*:\s*sanitizedDatabaseUrl\.toString\s*\(\s*\)/i);
        expect(concurrencyRunner).toMatch(/ssl\s*:\s*\{\s*rejectUnauthorized\s*:/i);
        expect(concurrencyRunner).toMatch(/requestedSslMode\s*===\s*'verify-full'/i);
        expect(concurrencyRunner.match(/new\s+Client\s*\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(concurrencyRunner).toMatch(/\.connect\s*\(\s*\)/i);
        expect(concurrencyRunner).toMatch(/\.query\s*\(/i);
        expect(concurrencyRunner).toMatch(/\.end\s*\(\s*\)/i);

        expect(concurrencyRunner).toMatch(/TEAM_VS_AUTHORITY/i);
        expect(concurrencyRunner).toMatch(/SAME_REQUEST/i);
        expect(concurrencyRunner).toMatch(/await\s+owner\.query\s*\(/i);
        expect(concurrencyRunner).toMatch(/await\s+contender\.query\s*\(/i);
        expect(concurrencyRunner).not.toMatch(/(?:setTimeout|pg_sleep)\s*\(/i);
        expect(concurrencyRunner).toMatch(
            /pg_advisory_xact_lock\s*\(\s*hashtextextended\s*\(\s*'profile-authority-canonical'\s*,\s*0\s*\)\s*\)/i,
        );
        expect(concurrencyRunner).toMatch(/v_actor\.role\s+IS\s+DISTINCT\s+FROM\s+'admin'/i);
        expect(concurrencyRunner).toMatch(/v_target\.role\s+IS\s+NOT\s+NULL/i);
        expect(concurrencyRunner).toMatch(/v_target\.parent_id\s+IS\s+NOT\s+NULL/i);
        expect(concurrencyRunner).toMatch(/v_target\.franchise_id\s+IS\s+NOT\s+NULL/i);
        expect(concurrencyRunner).toMatch(/FROM\s+public\.franchises[\s\S]*?is_active\s+IS\s+TRUE/i);
        expect(concurrencyRunner).toMatch(/update_team_member_name\s*\(/i);
        expect(concurrencyRunner.match(/change_profile_authority\s*\(/gi)?.length ?? 0).toBeGreaterThanOrEqual(3);
        expect(concurrencyRunner).toMatch(
            /change_profile_authority\s*\([\s\S]*?actorId[\s\S]*?'agent'[\s\S]*?actorId[\s\S]*?v_franchise_id/i,
        );
        expect(concurrencyRunner).toMatch(/lock_timeout\s*=\s*'[1-9][0-9]*(?:ms|s)'/i);
        expect(concurrencyRunner).toMatch(/statement_timeout\s*=\s*'[1-9][0-9]*(?:ms|s)'/i);
        expect(concurrencyRunner).toMatch(/\bBEGIN\s*;/i);
        expect(concurrencyRunner.match(/\bROLLBACK\s*;/gi)?.length ?? 0).toBeGreaterThanOrEqual(2);
        expect(concurrencyRunner).toMatch(/SAVEPOINT\s+authority_probe/i);
        expect(concurrencyRunner).toMatch(/ROLLBACK\s+TO\s+SAVEPOINT\s+authority_probe/i);
        expect(concurrencyRunner).toMatch(/55P03|LOCK_NOT_AVAILABLE|lock timeout/i);
    });

    it('probes the real source and identity rate thresholds', () => {
        expect(transactional).toMatch(/rate[-_ ]limit[^\r\n]*threshold/i);
        expect(transactional).toMatch(/(?:FOR\s+[a-z_]+\s+IN\s+1\.\.[0-9]+|generate_series\s*\()/i);
        expect(transactional).toMatch(
            /public\.consume_profile_join_rate_limit\s*\(\s*v_source_hash\s*,\s*v_identity_hash\s*\)/i,
        );
        expect(transactional).toMatch(/SQLERRM\s*=\s*'RATE_LIMITED'/i);
        expect(transactional).toMatch(
            /count\s*\(\s*\*\s*\)[^;]+FROM\s+public\.profile_join_rate_limit_receipts/i,
        );
        expect(transactional).toMatch(/RATE[^']*THRESHOLD[^']*(?:FAILED|ALLOWED|RECEIPT|NOT_ENFORCED)/i);
    });
});
