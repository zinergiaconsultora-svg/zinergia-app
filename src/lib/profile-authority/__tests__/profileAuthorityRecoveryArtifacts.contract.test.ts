import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptsDir = resolve(process.cwd(), 'supabase/scripts/profile-authority');
const names = existsSync(scriptsDir) ? readdirSync(scriptsDir) : [];
const recoveryNames = names.filter((name) => (
    /^\d{14}_recover_staging_canonical_admin\.sql$/i.test(name)
));
const verificationNames = names.filter((name) => (
    /^\d{14}_verify_staging_canonical_admin_recovery\.sql$/i.test(name)
));
const recovery = recoveryNames.length === 1
    ? readFileSync(resolve(scriptsDir, recoveryNames[0]), 'utf8')
    : '';
const verification = verificationNames.length === 1
    ? readFileSync(resolve(scriptsDir, verificationNames[0]), 'utf8')
    : '';

function withoutComments(sql: string) {
    return sql
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/--[^\r\n]*/g, '');
}

describe('ZIN-SDD-041 audited staging Admin recovery artifacts', () => {
    it('ships one timestamped one-off recovery and one timestamped verifier outside migrations', () => {
        expect(recoveryNames).toHaveLength(1);
        expect(verificationNames).toHaveLength(1);
        expect(recoveryNames[0]).not.toBe(verificationNames[0]);
        expect(recovery).toContain('This is not a migration');
        expect(recovery).toMatch(/Operator:/i);
        expect(recovery).toMatch(/Target:/i);
        expect(recovery).toMatch(/approved staging only/i);
        expect(recovery).toMatch(/Rollback:/i);
        expect(verification).toMatch(/READ ONLY/i);
        expect(verification).toMatch(/Rollback semantics:/i);
    });

    it('requires an explicit unresolved target and contains no remote or identity operation', () => {
        const executable = withoutComments(`${recovery}\n${verification}`);
        expect(recovery).toContain('__CONFIRM_STAGING_ONLY__');
        expect(verification).toContain('__CONFIRM_STAGING_ONLY__');
        expect(recovery).toMatch(/v_staging_confirmation\s+IS\s+DISTINCT\s+FROM\s+'STAGING_REVIEWED'/i);
        expect(verification).toMatch(/v_staging_confirmation\s+IS\s+DISTINCT\s+FROM\s+'STAGING_REVIEWED'/i);
        expect(recovery).toContain('__RECOVERY_TARGET_PROFILE_ID__');
        expect(verification).toContain('__RECOVERY_TARGET_PROFILE_ID__');
        expect(executable).not.toMatch(/\bauth\.users\b/i);
        expect(executable).not.toMatch(/\b(?:http|https):\/\//i);
        expect(executable).not.toMatch(/\b(?:email|full_name|phone|iban|dni|cups)\b/i);
        expect(executable).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
        expect(executable).not.toMatch(/RAISE\s+(?:NOTICE|LOG|INFO|WARNING)/i);
    });

    it('locks globally before rows and fails closed on the exact first-use candidate shape', () => {
        const globalLock = recovery.search(/pg_advisory_xact_lock\s*\(\s*hashtextextended\s*\(\s*'profile-authority-canonical'/i);
        const firstRowLock = recovery.search(/FOR\s+UPDATE/i);
        expect(globalLock).toBeGreaterThanOrEqual(0);
        expect(firstRowLock).toBeGreaterThan(globalLock);
        expect(recovery).toMatch(/v_canonical_admin_count\s*<>\s*0/i);
        expect(recovery).toMatch(/v_legacy_candidate_count\s*<>\s*1/i);
        expect(recovery).toMatch(/v_target\.role\s+IS\s+DISTINCT\s+FROM\s+'admin'/i);
        expect(recovery).toMatch(/v_target\.parent_id\s+IS\s+NULL\s+AND\s+v_target\.franchise_id\s+IS\s+NULL/i);
    });

    it('uses one canonical context-driven update and one exact security recovery event', () => {
        const setContext = recovery.search(/set_config\s*\(\s*'app\.profile_authority_context'\s*,\s*v_context::text/i);
        const updateTarget = recovery.search(/UPDATE\s+public\.profiles\s+AS\s+profile/i);
        expect(setContext).toBeGreaterThanOrEqual(0);
        expect(updateTarget).toBeGreaterThan(setContext);
        expect(recovery).toMatch(/'actor_id'\s*,\s*v_target_id/i);
        expect(recovery).toMatch(/'target_profile_id'\s*,\s*v_target_id/i);
        expect(recovery).toMatch(/'event_type'\s*,\s*'authority_changed'/i);
        expect(recovery).toMatch(/'reason_code'\s*,\s*'security_recovery'/i);
        expect(recovery).toMatch(/SET\s+role\s*=\s*'admin'\s*,\s*parent_id\s*=\s*NULL\s*,\s*franchise_id\s*=\s*NULL\s*,\s*authority_version\s*=\s*profile\.authority_version\s*\+\s*1/i);
        expect(recovery).not.toMatch(/INSERT\s+INTO\s+public\.profile_authority_events/i);
        expect(recovery).not.toMatch(/(?:UPDATE|DELETE\s+FROM|TRUNCATE)\s+public\.profile_authority_events/i);
        expect(recovery).toMatch(/WHERE\s+event\.request_id\s*=\s*v_request_id[\s\S]*?\)\s*<>\s*1/i);
    });

    it('makes only an exact immutable replay a no-op and clears context on failure', () => {
        expect(recovery).toMatch(/IF\s+FOUND\s+THEN[\s\S]*?RECOVERY_REQUEST_CONFLICT[\s\S]*?RETURN\s*;/i);
        expect(recovery).toMatch(/v_existing\.reason_code\s+IS\s+DISTINCT\s+FROM\s+'security_recovery'/i);
        expect(recovery).toMatch(/v_existing\.after_state\s+IS\s+DISTINCT\s+FROM\s+private\.profile_authority_state/i);
        expect(recovery).toMatch(/EXCEPTION\s+WHEN\s+OTHERS\s+THEN[\s\S]*?set_config\s*\(\s*'app\.profile_authority_context'\s*,\s*''/i);
        expect(recovery).not.toMatch(/ON\s+CONFLICT/i);
    });

    it('keeps the companion read-only, postcondition-only and rollback-only', () => {
        const executable = withoutComments(verification);
        expect(executable.trimStart()).toMatch(/^BEGIN\s+TRANSACTION[\s\S]*?READ\s+ONLY\s*;/i);
        expect(executable).toMatch(/\bROLLBACK\s*;\s*$/i);
        expect(executable).not.toMatch(/\bCOMMIT\s*;/i);
        expect(executable).not.toMatch(/\b(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE|ALTER|DROP|CREATE)\b/i);
        expect(verification).toMatch(/event\.reason_code\s+IS\s+DISTINCT\s+FROM\s+'security_recovery'/i);
        expect(verification).toMatch(/profile\.role\s*=\s*'admin'[\s\S]*?profile\.parent_id\s+IS\s+NULL[\s\S]*?profile\.franchise_id\s+IS\s+NULL/i);
    });
});
