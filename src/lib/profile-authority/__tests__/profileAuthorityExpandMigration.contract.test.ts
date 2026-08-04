import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = resolve(process.cwd(), 'supabase/migrations');
const migrationNames = existsSync(migrationsDir)
    ? readdirSync(migrationsDir).filter((name) => /^\d+_profile_authority_expand\.sql$/i.test(name))
    : [];
const migration = migrationNames.length === 1
    ? readFileSync(resolve(migrationsDir, migrationNames[0]), 'utf8')
    : '';
const compact = migration.replace(/\s+/g, ' ').trim();
const topLevelSql = migration
    .replace(/\$([a-zA-Z0-9_]*)\$[\s\S]*?\$\1\$/g, '')
    .replace(/--[^\r\n]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const protectedColumnName = /\b(email|password|token|raw_ip|full_name|phone|iban|fiscal|nif|dni|cups)\b/i;
const authorityRpcs = [
    'update_own_profile',
    'update_team_member_name',
    'change_profile_authority',
];
const provisioningRpcs = [
    'begin_profile_invitation_provisioning',
    'record_profile_invitation_auth_user',
    'finalize_profile_invitation_authority',
    'complete_profile_invitation_provisioning',
    'reconcile_profile_invitation_provisioning',
];

function tableDefinition(table: string) {
    return migration.match(new RegExp(
        `CREATE\\s+TABLE(?:\\s+IF\\s+NOT\\s+EXISTS)?\\s+public\\.${table}\\s*\\(([\\s\\S]*?)\\);`,
        'i',
    ))?.[1] ?? '';
}

function functionDefinition(name: string, schema = 'public') {
    return migration.match(new RegExp(
        `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+${schema}\\.${name}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS([\\s\\S]*?)\\$[^$]*\\$;`,
        'i',
    ))?.[0] ?? '';
}

function functionArguments(name: string) {
    return migration.match(new RegExp(
        `CREATE\\s+OR\\s+REPLACE\\s+FUNCTION\\s+public\\.${name}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS`,
        'i',
    ))?.[1].replace(/\s+/g, ' ').trim() ?? '';
}

function delegatedFinalizerCore() {
    return functionDefinition('finalize_profile_invitation_authority')
        .match(/RETURN\s+private\.([a-z0-9_]+)\s*\(/i)?.[1] ?? '';
}

function publicFunctionNames() {
    return [...migration.matchAll(
        /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi,
    )].map((match) => match[1]);
}

function hasServiceExecuteGrant(schema: string, name: string) {
    return new RegExp(
        `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+${schema}\\.${name}\\s*\\([^;]*\\)\\s+TO\\s+service_role`,
        'i',
    ).test(compact);
}

function expectServiceOnlyRpc(name: string) {
    const definition = functionDefinition(name);
    expect(definition, `missing public.${name}`).not.toBe('');
    expect(definition).toMatch(/SECURITY\s+INVOKER/i);
    expect(definition).toMatch(/SET\s+search_path\s*(?:=|TO)\s*''/i);
    expect(compact).toMatch(new RegExp(
        `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${name}\\s*\\([^;]*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated`,
        'i',
    ));
    expect(compact).toMatch(new RegExp(
        `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${name}\\s*\\([^;]*\\)\\s+TO\\s+service_role`,
        'i',
    ));
    expect(compact).not.toMatch(new RegExp(
        `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+public\\.${name}\\s*\\([^;]*\\)\\s+TO\\s+(?:PUBLIC|anon|authenticated)`,
        'i',
    ));
}

describe('ZIN-SDD-041 single profile_authority_expand migration contract (RED)', () => {
    it('uses exactly one timestamped expansion migration and adds authority_version without rewriting authority', () => {
        expect(migrationNames).toHaveLength(1);
        expect(migrationNames[0]).toMatch(/^\d{14}_profile_authority_expand\.sql$/);
        expect(compact).toMatch(
            /ALTER\s+TABLE\s+public\.profiles\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+authority_version\s+bigint\s+NOT\s+NULL\s+DEFAULT\s+0/i,
        );
        expect(topLevelSql).not.toMatch(
            /UPDATE\s+public\.profiles\s+SET[\s\S]{0,300}\b(role|parent_id|franchise_id)\s*=/i,
        );
    });

    it('creates immutable, request-idempotent authority events with no PII columns or destructive profile FK', () => {
        const events = tableDefinition('profile_authority_events');
        for (const column of [
            'id uuid',
            'actor_id uuid',
            'target_profile_id uuid',
            'event_type text',
            'reason_code text',
            'before_state jsonb',
            'after_state jsonb',
            'request_id uuid',
            'before_version bigint',
            'after_version bigint',
            'created_at timestamptz',
        ]) expect(events.toLowerCase()).toContain(column);

        expect(events).toMatch(/(?:UNIQUE\s*\(\s*request_id\s*\)|request_id\s+uuid[^,]*\bUNIQUE\b)/i);
        expect(events).not.toMatch(protectedColumnName);
        expect(events).not.toMatch(/(?:actor_id|target_profile_id)[^,]*REFERENCES\s+public\.profiles/i);
        expect(compact).toContain('ALTER TABLE public.profile_authority_events ENABLE ROW LEVEL SECURITY');
        expect(compact).toMatch(/CREATE\s+TRIGGER[^;]+BEFORE\s+UPDATE\s+OR\s+DELETE[^;]+ON\s+public\.profile_authority_events[^;]+FOR\s+EACH\s+ROW/i);
        expect(compact).toMatch(/CREATE\s+TRIGGER[^;]+BEFORE\s+TRUNCATE[^;]+ON\s+public\.profile_authority_events[^;]+FOR\s+EACH\s+STATEMENT/i);
        expect(compact).toMatch(/REVOKE\s+(?:ALL|UPDATE\s*,\s*DELETE\s*,\s*TRUNCATE)\s+ON(?:\s+TABLE)?\s+public\.profile_authority_events[^;]+PUBLIC\s*,\s*anon\s*,\s*authenticated/i);
    });

    it('restricts event snapshots to the three authority fields and inserts evidence in the guarded transaction', () => {
        expect(compact).toMatch(/jsonb_build_object\s*\(\s*'role'[^)]*'parent_id'[^)]*'franchise_id'/i);
        expect(compact).not.toMatch(/jsonb_build_object\s*\([^)]*'(?:email|phone|full_name|iban|nif_cif|fiscal_)/i);
        expect(compact).toMatch(/INSERT\s+INTO\s+public\.profile_authority_events/i);
        expect(compact).toMatch(/CREATE\s+TRIGGER[^;]+AFTER\s+UPDATE[^;]+ON\s+public\.profiles/i);
        expect(compact).toMatch(/CREATE\s+TRIGGER[^;]+BEFORE\s+UPDATE[^;]+ON\s+public\.profiles/i);
    });

    it('emits compatibility telemetry without a profile identifier or identity payload', () => {
        const guard = functionDefinition('profile_authority_guard', 'private');
        const legacyLog = guard.match(/RAISE\s+LOG\s+[^;]+;/i)?.[0] ?? '';

        expect(legacyLog).toContain('profile_authority_legacy_write');
        expect(legacyLog).not.toMatch(/(?:OLD|NEW)\.id|target_profile_id|email|phone|full_name/i);
    });

    it('defines exact authority RPC argument contracts and keeps every command service-only', () => {
        expect(functionArguments('update_own_profile')).toBe(
            'p_actor_id uuid, p_full_name text, p_phone text, p_bio text DEFAULT NULL, p_timezone text DEFAULT NULL',
        );
        expect(functionArguments('update_team_member_name')).toBe(
            'p_actor_id uuid, p_target_id uuid, p_full_name text',
        );
        expect(functionArguments('change_profile_authority')).toBe(
            'p_actor_id uuid, p_target_id uuid, p_desired_role text, p_parent_id uuid, p_franchise_id uuid, p_expected_authority_version bigint, p_reason_code text, p_request_id uuid',
        );
        for (const rpc of authorityRpcs) expectServiceOnlyRpc(rpc);
    });

    it('does not expose the deprecated invitation compatibility wrapper as an authority RPC', () => {
        const legacyName = 'consume_network_invitation_profile';
        const legacy = functionDefinition(legacyName);
        if (!legacy) return;

        expect(compact).toMatch(new RegExp(
            `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${legacyName}\\s*\\([^;]*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`,
            'i',
        ));
        expect(hasServiceExecuteGrant('public', legacyName)).toBe(false);
    });

    it('enforces canonical tuples, locking, last-Admin, cycles, versioning, reasons and idempotency inside change_profile_authority', () => {
        const command = functionDefinition('change_profile_authority').replace(/\s+/g, ' ');
        expect(command).toMatch(/FROM\s+public\.profiles[^;]+FOR\s+UPDATE/i);
        expect(command).toMatch(/IF\s+p_desired_role\s+IS\s+NULL\s+AND\s+p_parent_id\s+IS\s+NULL\s+AND\s+p_franchise_id\s+IS\s+NULL\s+THEN/i);
        expect(command).toMatch(/ELSIF\s+p_desired_role\s*=\s*'admin'\s+AND\s+p_parent_id\s+IS\s+NULL\s+AND\s+p_franchise_id\s+IS\s+NULL\s+THEN/i);
        expect(command).toMatch(/ELSIF\s+p_desired_role\s+IN\s*\(\s*'agent'\s*,\s*'franchise'\s*\)\s+THEN/i);
        expect(command).toMatch(/p_parent_id\s+IS\s+NULL\s+OR\s+p_franchise_id\s+IS\s+NULL/i);
        expect(command).toMatch(/p_parent_id\s*=\s*p_target_id/i);
        expect(command).toContain('AUTHORITY_TUPLE_INVALID');
        expect(command).toMatch(/f\.id\s*=\s*p_franchise_id\s+AND\s+f\.is_active\s+IS\s+TRUE/i);
        expect(command).toMatch(/authority_version\s*(?:<>|!=)\s*p_expected_authority_version/i);
        expect(command).toMatch(/WITH\s+RECURSIVE/i);
        expect(command).toContain('LAST_ADMIN');
        expect(command).toMatch(/count\s*\(\s*\*\s*\)[^;]+role\s*=\s*'admin'/i);
        expect(command).toMatch(/profile_authority_events[^;]+request_id\s*=\s*p_request_id/i);
        expect(command).toMatch(/REQUEST_ID_CONFLICT|request[^;]+conflict/i);
        for (const reason of [
            'role_change', 'franchise_assignment', 'franchise_removal', 'deactivation',
            'reactivation', 'invitation_acceptance', 'authority_correction', 'security_recovery',
        ]) expect(command).toContain(`'${reason}'`);
        expect(command).toMatch(/authority_version\s*=\s*authority_version\s*\+\s*1/i);
    });

    it('adds and validates target_franchise_id without inventing an Admin or Franchise target', () => {
        expect(compact).toMatch(/ALTER\s+TABLE\s+public\.network_invitations\s+ADD\s+COLUMN(?:\s+IF\s+NOT\s+EXISTS)?\s+target_franchise_id\s+uuid/i);
        expect(compact).toMatch(/FOREIGN\s+KEY\s*\(\s*target_franchise_id\s*\)\s+REFERENCES\s+public\.franchises\s*\(\s*id\s*\)/i);
        const validatesTargetFranchiseInline = /target_franchise_id[^;]+is_active/i.test(compact);
        const lockedTargetFranchise = compact.match(
            /SELECT\s+\*\s+INTO\s+(v_[a-z0-9_]+)\s+FROM\s+public\.franchises\s+f\s+WHERE\s+f\.id\s*=\s*v_invitation\.target_franchise_id\s+FOR\s+UPDATE\s*;\s*IF\s+\1\.id\s+IS\s+NULL\s+OR\s+\1\.is_active\s+IS\s+NOT\s+TRUE/i,
        );
        expect(
            validatesTargetFranchiseInline || lockedTargetFranchise !== null,
            'target franchise must be validated as active, directly or through its locked row',
        ).toBe(true);
        expect(compact).toMatch(/creator[^;]+role\s*=\s*'admin'[^;]+target_franchise_id\s+IS\s+NOT\s+NULL/i);
        expect(compact).toMatch(/creator[^;]+role\s*=\s*'franchise'[^;]+(?:invitation\.)?role\s*=\s*'agent'/i);
        expect(compact).not.toMatch(/coalesce\s*\(\s*(?:invitation\.)?target_franchise_id[^)]*(?:hq|creator[^)]*franchise_id)/i);
    });

    it('creates a PII-minimal provisioning state machine with three independent uniqueness boundaries', () => {
        const provisioning = tableDefinition('profile_invitation_provisioning');
        for (const state of [
            'prepared', 'auth_created_blocked', 'authority_committed', 'completed', 'needs_reconciliation',
        ]) expect(provisioning).toContain(`'${state}'`);
        for (const column of ['invitation_id', 'request_id', 'auth_user_id']) {
            expect(provisioning).toMatch(new RegExp(
                `(?:UNIQUE\\s*\\(\\s*${column}\\s*\\)|${column}[^,]*\\bUNIQUE\\b)`,
                'i',
            ));
        }
        expect(provisioning).not.toMatch(/\b(email|password|token|raw_ip)\b/i);
        expect(compact).toContain('ALTER TABLE public.profile_invitation_provisioning ENABLE ROW LEVEL SECURITY');
        expect(compact).toMatch(/REVOKE\s+ALL\s+ON(?:\s+TABLE)?\s+public\.profile_invitation_provisioning\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i);
    });

    it('defines purpose-bound provisioning primitives without accepting client authority', () => {
        const requiredArgs: Record<string, string[]> = {
            begin_profile_invitation_provisioning: ['p_invitation_id uuid', 'p_expected_email text', 'p_request_id uuid'],
            record_profile_invitation_auth_user: ['p_provisioning_id uuid', 'p_auth_user_id uuid', 'p_banned_until timestamptz'],
            finalize_profile_invitation_authority: ['p_provisioning_id uuid', 'p_full_name text'],
            complete_profile_invitation_provisioning: ['p_provisioning_id uuid'],
            reconcile_profile_invitation_provisioning: ['p_limit integer'],
        };
        for (const rpc of provisioningRpcs) {
            const args = functionArguments(rpc);
            expect(args, `${rpc} arguments`).not.toBe('');
            for (const required of requiredArgs[rpc]) expect(args).toContain(required);
            expect(args).not.toMatch(/p_(?:desired_)?role|p_parent_id|p_franchise_id/i);
            expectServiceOnlyRpc(rpc);
        }
    });

    it('finalizes invitation, neutral profile, authority event and provisioning state atomically under locks', () => {
        const publicFinalizer = functionDefinition('finalize_profile_invitation_authority').replace(/\s+/g, ' ');
        const delegatedCore = publicFinalizer.match(/RETURN\s+private\.([a-z0-9_]+)\s*\(/i)?.[1];
        const lockOwner = delegatedCore
            ? functionDefinition(delegatedCore, 'private').replace(/\s+/g, ' ')
            : publicFinalizer;

        if (delegatedCore) {
            expect(publicFinalizer).toMatch(new RegExp(
                `AS\\s+\\$\\$\\s*BEGIN\\s+RETURN\\s+private\\.${delegatedCore}\\s*\\([^;]+\\);\\s*END;\\s*\\$\\$;`,
                'i',
            ));
            expect(publicFinalizer).not.toMatch(/\b(?:SELECT|INSERT|UPDATE|DELETE)\b/i);
            expect(compact).toMatch(new RegExp(
                `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+private\\.${delegatedCore}\\s*\\([^;]*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated(?:\\s*,\\s*service_role)?`,
                'i',
            ));
        }

        expect(lockOwner, 'missing finalization core').not.toBe('');
        expect(lockOwner).toMatch(/network_invitations[^;]+FOR\s+UPDATE/i);
        expect(lockOwner).toMatch(/profile_invitation_provisioning[^;]+FOR\s+UPDATE/i);
        expect(lockOwner).toMatch(/profiles[^;]+FOR\s+UPDATE/i);
        expect(lockOwner).toMatch(/role\s+IS\s+NULL[^;]+parent_id\s+IS\s+NULL[^;]+franchise_id\s+IS\s+NULL/i);
        expect(lockOwner).toMatch(/UPDATE\s+public\.network_invitations[^;]+used\s*=\s*true/i);
        expect(lockOwner).toMatch(/authority_committed/i);
        expect(lockOwner).toMatch(/invitation_acceptance/i);
        expect(lockOwner).not.toMatch(/coalesce\s*\([^)]*(?:hq|franchise_id)/i);
    });

    it('keeps the delegated private finalization core callable only by service_role', () => {
        const core = delegatedFinalizerCore();
        expect(core, 'public finalizer must delegate to one private core').not.toBe('');
        const coreDefinition = functionDefinition(core, 'private');
        expect(coreDefinition).toMatch(/SECURITY\s+INVOKER/i);
        expect(coreDefinition).toMatch(/SET\s+search_path\s*(?:=|TO)\s*''/i);
        expect(compact).toMatch(new RegExp(
            `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+private\\.${core}\\s*\\([^;]*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated`,
            'i',
        ));
        expect(hasServiceExecuteGrant('private', core), 'service_role cannot execute the delegated core').toBe(true);
        expect(compact).not.toMatch(new RegExp(
            `GRANT\\s+EXECUTE\\s+ON\\s+FUNCTION\\s+private\\.${core}\\s*\\([^;]*\\)\\s+TO\\s+(?:PUBLIC|anon|authenticated)`,
            'i',
        ));
    });

    it('uses NULL-safe role comparisons for the Admin actor and every permitted parent branch', () => {
        const command = functionDefinition('change_profile_authority').replace(/\s+/g, ' ');
        expect(command).toMatch(/v_actor\.role\s+IS\s+DISTINCT\s+FROM\s+'admin'/i);
        expect(command).toMatch(/v_parent\.role\s+IS\s+DISTINCT\s+FROM\s+'admin'/i);
        expect(command).toMatch(/v_parent\.role\s+IS\s+NOT\s+DISTINCT\s+FROM\s+'admin'/i);
        expect(command).toMatch(/v_parent\.role\s+IS\s+NOT\s+DISTINCT\s+FROM\s+'franchise'/i);
        expect(command).not.toMatch(/v_(?:actor|parent)\.role\s*(?:<>|!=)\s*'(?:admin|franchise)'/i);
    });

    it('fails closed when expectedAuthorityVersion or reasonCode is NULL', () => {
        const command = functionDefinition('change_profile_authority').replace(/\s+/g, ' ');
        const inputGuard = command.match(
            /BEGIN\s+IF\s+([\s\S]*?)\s+THEN\s+RAISE\s+EXCEPTION[^;]+AUTHORITY_INPUT_INVALID/i,
        )?.[1] ?? '';

        expect(inputGuard).toMatch(/p_expected_authority_version\s+IS\s+NULL/i);
        expect(inputGuard).toMatch(/p_reason_code\s+IS\s+NULL/i);
    });

    it('binds request idempotency to expected before_version both before and after the global lock', () => {
        const command = functionDefinition('change_profile_authority').replace(/\s+/g, ' ');
        const advisoryLock = command.search(/PERFORM\s+pg_advisory_xact_lock\s*\(/i);
        const firstRowLock = command.search(/PERFORM\s+1\s+FROM\s+public\.profiles[\s\S]*?FOR\s+UPDATE/i);
        expect(advisoryLock).toBeGreaterThanOrEqual(0);
        expect(firstRowLock).toBeGreaterThan(advisoryLock);

        const preLock = command.slice(0, advisoryLock);
        const postLock = command.slice(advisoryLock, firstRowLock);
        const expectedVersionComparison = /v_existing\.before_version\s+IS\s+DISTINCT\s+FROM\s+p_expected_authority_version/i;
        expect(preLock).toMatch(expectedVersionComparison);
        expect(postLock).toMatch(expectedVersionComparison);
    });

    it('compares the trusted actor identity NULL-safely in both idempotency checks', () => {
        const command = functionDefinition('change_profile_authority').replace(/\s+/g, ' ');
        const nullSafeActorChecks = command.match(
            /v_existing\.actor_id\s+IS\s+DISTINCT\s+FROM\s+p_actor_id/gi,
        ) ?? [];

        expect(nullSafeActorChecks).toHaveLength(2);
        expect(command).not.toMatch(/v_existing\.actor_id\s*(?:<>|!=)\s*p_actor_id/i);
    });

    it('rejects cross-domain request_id reuse under the shared global advisory lock', () => {
        const cases = [
            {
                definition: functionDefinition('change_profile_authority').replace(/\s+/g, ' '),
                otherTable: 'profile_invitation_provisioning',
            },
            {
                definition: functionDefinition('begin_profile_invitation_provisioning').replace(/\s+/g, ' '),
                otherTable: 'profile_authority_events',
            },
        ];

        for (const { definition, otherTable } of cases) {
            const globalLock = definition.search(/pg_advisory_xact_lock\s*\(/i);
            const crossDomainCheck = definition.search(new RegExp(
                `(?:FROM|JOIN)\\s+public\\.${otherTable}[^;]+request_id\\s*=\\s*p_request_id`,
                'i',
            ));
            expect(globalLock, `${otherTable}: missing shared global advisory`).toBeGreaterThanOrEqual(0);
            expect(crossDomainCheck, `${otherTable}: missing cross-domain request_id check`).toBeGreaterThan(globalLock);
            expect(definition.slice(crossDomainCheck)).toMatch(/REQUEST_ID_CONFLICT/i);
        }
    });

    it('persists a rate-limit attempt even when later invitation validation fails', () => {
        const begin = functionDefinition('begin_profile_invitation_provisioning').replace(/\s+/g, ' ');
        const separateConsumers = publicFunctionNames().filter((name) => {
            if (name === 'begin_profile_invitation_provisioning') return false;
            const definition = functionDefinition(name);
            return /INSERT\s+INTO\s+public\.profile_join_rate_limits/i.test(definition)
                && /(?:rate_limit|attempt)/i.test(name);
        });
        const invalidInvitationBranch = begin.match(
            /IF\s+NOT\s+FOUND\s+OR[\s\S]*?MESSAGE\s*=\s*'INVITATION_INVALID'[\s\S]*?END\s+IF;/i,
        )?.[0] ?? '';
        const commitsDeniedResult = invalidInvitationBranch !== ''
            && /RETURN\s+jsonb_build_object/i.test(invalidInvitationBranch)
            && !/RAISE\s+EXCEPTION/i.test(invalidInvitationBranch);

        expect(
            separateConsumers.length === 1 || commitsDeniedResult,
            'rate-limit INSERT rolls back when a later invalid invitation raises',
        ).toBe(true);

        if (separateConsumers.length === 1) {
            const consumer = separateConsumers[0];
            expectServiceOnlyRpc(consumer);
            expect(functionArguments(consumer)).not.toMatch(/email|raw_ip|password|token/i);
            expect(begin).not.toMatch(/INSERT\s+INTO\s+public\.profile_join_rate_limits/i);
        }
    });

    it('takes a global advisory transaction lock before any finalization row lock', () => {
        const core = delegatedFinalizerCore();
        const definition = functionDefinition(
            core || 'finalize_profile_invitation_authority',
            core ? 'private' : 'public',
        ).replace(/\s+/g, ' ');
        const globalLock = definition.search(/pg_advisory_xact_lock\s*\(/i);
        const firstRowLock = definition.search(/FOR\s+UPDATE/i);

        expect(globalLock, 'finalization core lacks a global advisory lock').toBeGreaterThanOrEqual(0);
        expect(firstRowLock, 'finalization core lacks row locks').toBeGreaterThanOrEqual(0);
        expect(globalLock, 'global lock must precede all row locks').toBeLessThan(firstRowLock);
    });

    it('exposes exactly one service-granted public finalization route with no wrapper bypass', () => {
        const core = delegatedFinalizerCore();
        expect(core).not.toBe('');
        const publicCoreCallers = publicFunctionNames().filter((name) =>
            new RegExp(`private\\.${core}\\s*\\(`, 'i').test(functionDefinition(name)),
        );
        const serviceGrantedCallers = publicCoreCallers.filter((name) =>
            hasServiceExecuteGrant('public', name),
        );

        expect(serviceGrantedCallers).toEqual(['finalize_profile_invitation_authority']);
        for (const bypass of publicCoreCallers.filter((name) => name !== 'finalize_profile_invitation_authority')) {
            expect(compact).toMatch(new RegExp(
                `REVOKE\\s+ALL\\s+ON\\s+FUNCTION\\s+public\\.${bypass}\\s*\\([^;]*\\)\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated\\s*,\\s*service_role`,
                'i',
            ));
            expect(hasServiceExecuteGrant('public', bypass)).toBe(false);
        }
    });

    it('closes transitive public finalization wrappers and preserves global-before-row lock order', () => {
        const finalizer = 'finalize_profile_invitation_authority';
        const core = delegatedFinalizerCore();
        expect(core).not.toBe('');

        const publicNames = publicFunctionNames();
        const finalizationGraph = new Set(
            publicNames.filter((name) =>
                new RegExp(`private\\.${core}\\s*\\(`, 'i').test(functionDefinition(name)),
            ),
        );
        let discoveredWrapper = true;
        while (discoveredWrapper) {
            discoveredWrapper = false;
            for (const name of publicNames) {
                if (finalizationGraph.has(name)) continue;
                const definition = functionDefinition(name);
                const callsKnownRoute = [...finalizationGraph].some((callee) =>
                    new RegExp(`public\\.${callee}\\s*\\(`, 'i').test(definition),
                );
                if (callsKnownRoute) {
                    finalizationGraph.add(name);
                    discoveredWrapper = true;
                }
            }
        }

        const serviceGrantedRoutes = [...finalizationGraph]
            .filter((name) => hasServiceExecuteGrant('public', name))
            .sort();
        const lockOrderViolations = [...finalizationGraph]
            .filter((name) => name !== finalizer)
            .filter((name) => {
                const definition = functionDefinition(name).replace(/\s+/g, ' ');
                const firstRowLock = definition.search(/FOR\s+UPDATE/i);
                if (firstRowLock < 0) return false;
                const globalLock = definition.search(/pg_advisory_xact_lock\s*\(/i);
                return globalLock < 0 || globalLock > firstRowLock;
            })
            .sort();

        expect({ serviceGrantedRoutes, lockOrderViolations }).toEqual({
            serviceGrantedRoutes: [finalizer],
            lockOrderViolations: [],
        });
    });

    it('requires a fresh banned_until observation before finalizing invitation authority', () => {
        const publicArgs = functionArguments('finalize_profile_invitation_authority');
        const publicFinalizer = functionDefinition('finalize_profile_invitation_authority');
        const core = delegatedFinalizerCore();
        const enforcement = `${publicFinalizer}\n${core ? functionDefinition(core, 'private') : ''}`
            .replace(/\s+/g, ' ');

        expect(publicArgs).toContain('p_observed_banned_until timestamptz');
        expect(enforcement).toMatch(/p_observed_banned_until\s+IS\s+NULL/i);
        expect(enforcement).toMatch(/p_observed_banned_until\s*<=\s*(?:statement_timestamp\s*\(\s*\)|clock_timestamp\s*\(\s*\)|now\s*\(\s*\))/i);
        expect(enforcement).toMatch(
            /v_provisioning\.banned_until\s+IS\s+DISTINCT\s+FROM\s+p_observed_banned_until/i,
        );
    });

    it('rejects a NULL or blank full_name before finalizing invitation authority', () => {
        const publicFinalizer = functionDefinition('finalize_profile_invitation_authority');
        const core = delegatedFinalizerCore();
        const enforcement = `${publicFinalizer}\n${core ? functionDefinition(core, 'private') : ''}`
            .replace(/\s+/g, ' ');

        expect(enforcement).toMatch(
            /(?:p_full_name\s+IS\s+NULL|nullif\s*\(\s*btrim\s*\(\s*p_full_name\s*\)\s*,\s*''\s*\)\s+IS\s+NULL)/i,
        );
        expect(enforcement).toMatch(/(?:PROVISIONING_INPUT_INVALID|FULL_NAME_INVALID)/i);
    });

    it('takes the global authority advisory before update_team_member_name profile locks', () => {
        const command = functionDefinition('update_team_member_name').replace(/\s+/g, ' ');
        const globalLock = command.search(/pg_advisory_xact_lock\s*\(/i);
        const firstProfileLock = command.search(/FROM\s+public\.profiles[\s\S]*?FOR\s+UPDATE/i);

        expect(globalLock, 'team-member update lacks global authority advisory').toBeGreaterThanOrEqual(0);
        expect(firstProfileLock, 'team-member update lacks profile row locks').toBeGreaterThanOrEqual(0);
        expect(globalLock, 'global advisory must precede profile locks').toBeLessThan(firstProfileLock);
    });

    it('uses a shared peppered rate-limit relation with expiry cleanup and no raw identifiers', () => {
        const rateLimitTableName = compact.match(/CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+public\.([a-z0-9_]*rate_limit[a-z0-9_]*)/i)?.[1] ?? '';
        expect(rateLimitTableName).not.toBe('');
        const rateLimit = tableDefinition(rateLimitTableName);
        expect(rateLimit).toMatch(/(?:identifier|key|bucket)_hash\s+(?:text|bytea)/i);
        expect(rateLimit).toMatch(/expires_at\s+timestamptz/i);
        expect(rateLimit).not.toMatch(/\b(email|raw_ip|password|token)\b/i);
        expect(compact).toContain(`ALTER TABLE public.${rateLimitTableName} ENABLE ROW LEVEL SECURITY`);
        expect(compact).toMatch(new RegExp(
            `CREATE\\s+INDEX[^;]+ON\\s+public\\.${rateLimitTableName}[^;]+expires_at`,
            'i',
        ));
        expect(compact).toMatch(new RegExp(
            `REVOKE\\s+ALL\\s+ON(?:\\s+TABLE)?\\s+public\\.${rateLimitTableName}\\s+FROM\\s+PUBLIC\\s*,\\s*anon\\s*,\\s*authenticated`,
            'i',
        ));
        expect(compact).toMatch(new RegExp(
            `GRANT\\s+(?:SELECT\\s*,\\s*INSERT\\s*,\\s*UPDATE\\s*,\\s*DELETE|ALL)\\s+ON(?:\\s+TABLE)?\\s+public\\.${rateLimitTableName}\\s+TO\\s+service_role`,
            'i',
        ));
    });

    it('durably correlates begin provisioning with a non-PII rate-limit receipt', () => {
        const consumer = functionDefinition('consume_profile_join_rate_limit').replace(/\s+/g, ' ');
        const begin = functionDefinition('begin_profile_invitation_provisioning').replace(/\s+/g, ' ');
        const beginArgs = functionArguments('begin_profile_invitation_provisioning');
        const receiptArg = beginArgs.match(
            /\b(p_(?:(?:rate_limit_)?(?:receipt|consumption|attempt)|rate_limit)_id)\s+uuid\b/i,
        )?.[1] ?? '';
        expect(receiptArg, 'begin lacks a rate-limit receipt UUID').not.toBe('');

        const requestedColumn = receiptArg.replace(/^p_/, '');
        const tables = [...migration.matchAll(
            /CREATE\s+TABLE(?:\s+IF\s+NOT\s+EXISTS)?\s+public\.([a-z0-9_]+)\s*\(([\s\S]*?)\);/gi,
        )];
        const durableTable = tables.map((match) => {
            const [, name, definition] = match;
            if (new RegExp(`\\b${requestedColumn}\\s+uuid\\b`, 'i').test(definition)) {
                return { name, definition, receiptColumn: requestedColumn };
            }
            if (/rate_limit.*receipt|receipt.*rate_limit/i.test(name) && /\bid\s+uuid\b/i.test(definition)) {
                return { name, definition, receiptColumn: 'id' };
            }
            return null;
        }).find((candidate) => candidate !== null);

        expect(durableTable, 'receipt UUID is not durably persisted').toBeDefined();
        expect(durableTable?.definition ?? '').not.toMatch(protectedColumnName);
        expect(durableTable?.definition ?? '').toMatch(/expires_at\s+timestamptz/i);

        const tableName = durableTable?.name ?? '__missing__';
        const receiptColumn = durableTable?.receiptColumn ?? '__missing__';
        expect(consumer).toMatch(new RegExp(
            `INSERT\\s+INTO\\s+public\\.${tableName}\\s*\\([^)]*${receiptColumn}`,
            'i',
        ));
        expect(consumer).toMatch(/jsonb_build_object\s*\([^)]*'(?:rate_limit_)?receipt_id'/i);
        expect(begin).toMatch(new RegExp(
            `(?:FROM|JOIN|UPDATE)\\s+public\\.${tableName}[^;]+${receiptColumn}\\s*=\\s*${receiptArg}`,
            'i',
        ));
        expect(begin).toMatch(/(?:consumed_at|used_at|provisioning_id|DELETE\s+FROM)/i);
    });

    it('loads and locks the invitation and compares email before any existing-provisioning return', () => {
        const begin = functionDefinition('begin_profile_invitation_provisioning').replace(/\s+/g, ' ');
        const invitationLock = begin.search(
            /SELECT\s+\*\s+INTO\s+v_invitation\s+FROM\s+public\.network_invitations\s+WHERE\s+id\s*=\s*p_invitation_id\s+FOR\s+UPDATE/i,
        );
        const emailComparison = begin.search(
            /lower\s*\(\s*btrim\s*\(\s*v_invitation\.email\s*\)\s*\)\s+IS\s+DISTINCT\s+FROM\s+lower\s*\(\s*btrim\s*\(\s*p_expected_email\s*\)\s*\)/i,
        );
        const firstExistingReturn = begin.search(
            /RETURN\s+jsonb_build_object\s*\([^;]*'provisioning_id'\s*,\s*v_existing\.id/i,
        );

        expect(invitationLock).toBeGreaterThanOrEqual(0);
        expect(emailComparison).toBeGreaterThan(invitationLock);
        expect(firstExistingReturn).toBeGreaterThan(emailComparison);
    });

    it('lets only evidence-backed postcommit retries bypass invitation freshness', () => {
        const begin = functionDefinition('begin_profile_invitation_provisioning').replace(/\s+/g, ' ');
        const postcommitProof = begin.search(/v_existing\.authority_committed_at\s+IS\s+NOT\s+NULL/i);
        const freshnessCheck = begin.search(
            /v_invitation\.used\s+IS\s+TRUE[\s\S]*?v_invitation\.expires_at\s*(?:IS\s+NULL|<=)/i,
        );
        const postcommitReturn = postcommitProof >= 0
            ? begin.slice(postcommitProof, freshnessCheck >= 0 ? freshnessCheck : undefined).search(
                /RETURN\s+jsonb_build_object\s*\([^;]*'provisioning_id'\s*,\s*v_existing\.id/i,
            ) + postcommitProof
            : -1;

        expect(postcommitProof, 'postcommit retry lacks authority_committed_at evidence').toBeGreaterThanOrEqual(0);
        expect(postcommitReturn, 'postcommit retry lacks a durable return').toBeGreaterThan(postcommitProof);
        expect(freshnessCheck, 'precommit path lacks unused/unexpired invitation validation').toBeGreaterThan(postcommitReturn);

        const precommitTail = begin.slice(freshnessCheck);
        const creatorCanonical = precommitTail.search(/v_creator\.role\s*(?:IS\s+NOT\s+DISTINCT\s+FROM|=)\s*'(?:admin|franchise)'/i);
        const activeFranchise = precommitTail.search(/v_franchise\.is_active\s+IS\s+NOT\s+TRUE/i);
        const precommitReturn = precommitTail.search(
            /RETURN\s+jsonb_build_object\s*\([^;]*'provisioning_id'\s*,\s*v_existing\.id/i,
        );
        expect(creatorCanonical, 'precommit retry lacks canonical creator validation').toBeGreaterThanOrEqual(0);
        expect(activeFranchise, 'precommit retry lacks active-franchise validation').toBeGreaterThanOrEqual(0);
        expect(precommitReturn, 'precommit retry lacks durable resume').toBeGreaterThan(creatorCanonical);
        expect(precommitReturn).toBeGreaterThan(activeFranchise);
    });

    it('proves postcommit retry with the stored event identity, target and invitation source', () => {
        const begin = functionDefinition('begin_profile_invitation_provisioning').replace(/\s+/g, ' ');
        const freshnessCheck = begin.search(/v_invitation\.used\s+IS\s+TRUE/i);
        const proof = freshnessCheck >= 0
            ? begin.slice(0, freshnessCheck)
            : '';

        expect(proof).toMatch(/FROM\s+public\.profile_authority_events/i);
        expect(proof).toMatch(/request_id\s*=\s*v_existing\.request_id/i);
        expect(proof).toMatch(/target_profile_id\s*(?:=|IS\s+NOT\s+DISTINCT\s+FROM)\s*v_existing\.auth_user_id/i);
        expect(proof).toMatch(/source_id\s*(?:=|IS\s+NOT\s+DISTINCT\s+FROM)\s*(?:v_existing\.invitation_id|p_invitation_id)/i);
        expect(proof).toMatch(/event_type\s*(?:=|IS\s+NOT\s+DISTINCT\s+FROM)\s*'invitation_authority_committed'/i);
        expect(proof).toMatch(
            /(?:v_has_exact_authority_event\s+IS\s+NOT\s+TRUE|NOT\s+EXISTS\s*\([^;]+target_profile_id[^;]+source_id[^;]+event_type[^;]+\))[\s\S]*?PROVISIONING_STATE_INVALID/i,
        );
    });

    it('accepts a regenerated retry request_id and returns the existing durable request_id', () => {
        const begin = functionDefinition('begin_profile_invitation_provisioning').replace(/\s+/g, ' ');
        expect(begin).toMatch(
            /RETURN\s+jsonb_build_object\s*\([^;]*'request_id'\s*,\s*v_existing\.request_id/i,
        );
        expect(begin).not.toMatch(
            /v_existing\.request_id\s+IS\s+DISTINCT\s+FROM\s+p_request_id[\s\S]*?REQUEST_ID_CONFLICT/i,
        );
    });

    it('allows a new rate receipt to be claimed with a previously used logical request_id', () => {
        const receipts = tableDefinition('profile_join_rate_limit_receipts');
        expect(receipts).not.toMatch(/request_id\s+uuid[^,]*\bUNIQUE\b/i);
        expect(receipts).not.toMatch(/UNIQUE\s*\(\s*request_id\s*\)/i);
        expect(compact).not.toMatch(
            /CREATE\s+UNIQUE\s+INDEX[^;]+ON\s+public\.profile_join_rate_limit_receipts\s*\(\s*request_id\s*\)/i,
        );
    });

    it('replaces handle_new_user with a neutral, non-overwriting, hardened Auth bootstrap', () => {
        const bootstrap = functionDefinition('handle_new_user').replace(/\s+/g, ' ');
        expect(bootstrap).toMatch(/SECURITY\s+DEFINER/i);
        expect(bootstrap).toMatch(/SET\s+search_path\s*(?:=|TO)\s*''/i);
        expect(bootstrap).toMatch(/INSERT\s+INTO\s+public\.profiles[^;]+role[^;]+parent_id[^;]+franchise_id/i);
        expect(bootstrap).toMatch(/VALUES[^;]+NULL[^;]+NULL[^;]+NULL/i);
        expect(bootstrap).not.toMatch(/['"]agent['"]/i);
        const conflictClause = bootstrap.match(/ON\s+CONFLICT\s*\(\s*id\s*\)\s+DO\s+(NOTHING|UPDATE\s+SET[\s\S]*?);/i)?.[0] ?? '';
        expect(conflictClause).not.toBe('');
        expect(conflictClause).not.toMatch(/\b(role|parent_id|franchise_id|authority_version)\s*=/i);
        if (/DO\s+UPDATE/i.test(conflictClause)) {
            const assignments = [...conflictClause.matchAll(/\b([a-z_]+)\s*=\s*EXCLUDED\./gi)]
                .map((match) => match[1])
                .sort();
            expect(assignments).toEqual(expect.arrayContaining(['email', 'full_name']));
            expect(assignments.every((column) => ['email', 'full_name'].includes(column))).toBe(true);
        }
        expect(compact).toMatch(/CREATE\s+TRIGGER[^;]+AFTER\s+INSERT\s+ON\s+auth\.users[^;]+EXECUTE\s+(?:FUNCTION|PROCEDURE)\s+public\.handle_new_user\s*\(\s*\)/i);
        expect(compact).toMatch(/REVOKE\s+ALL\s+ON\s+FUNCTION\s+public\.handle_new_user\s*\(\s*\)\s+FROM\s+PUBLIC\s*,\s*anon\s*,\s*authenticated/i);
    });

    it('keeps reconciliation service-only, bounded and free of invitation email payloads', () => {
        const reconciler = functionDefinition('reconcile_profile_invitation_provisioning').replace(/\s+/g, ' ');
        expect(reconciler).toMatch(/LIMIT\s+(?:p_limit|least\s*\(\s*p_limit\s*,\s*100\s*\))/i);
        expect(reconciler).toMatch(/FOR\s+UPDATE\s+SKIP\s+LOCKED/i);
        expect(reconciler).toMatch(/needs_reconciliation|auth_created_blocked|authority_committed/i);
        expect(reconciler).not.toMatch(/SELECT[^;]+\bemail\b|RETURN(?:S|\s+QUERY)[^;]+\bemail\b/i);
        expectServiceOnlyRpc('reconcile_profile_invitation_provisioning');
    });

    it('advances the reconciliation lease timestamp when claiming rows', () => {
        const reconciler = functionDefinition('reconcile_profile_invitation_provisioning').replace(/\s+/g, ' ');
        const claimUpdate = reconciler.match(
            /touched\s+AS\s*\(\s*UPDATE\s+public\.profile_invitation_provisioning[\s\S]*?FROM\s+candidates\b[\s\S]*?RETURNING\s+p\.\*/i,
        )?.[0] ?? '';

        expect(claimUpdate).not.toBe('');
        expect(claimUpdate).toMatch(/SET[\s\S]*?updated_at\s*=\s*(?:statement_timestamp\s*\(\s*\)|clock_timestamp\s*\(\s*\)|now\s*\(\s*\))/i);
        expect(claimUpdate).toMatch(/last_attempt_at\s*=\s*(?:statement_timestamp\s*\(\s*\)|clock_timestamp\s*\(\s*\)|now\s*\(\s*\))/i);
    });
});
