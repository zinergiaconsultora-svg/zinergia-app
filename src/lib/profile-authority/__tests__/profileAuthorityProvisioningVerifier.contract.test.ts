import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = resolve(process.cwd(), 'scripts/profile-authority/verify-provisioning-staging.mjs');

describe('ZIN-SDD-041 post-contract provisioning verifier', () => {
    it('is staging-gated, rollback-only and cleans its owned Auth fixture', () => {
        expect(existsSync(scriptPath)).toBe(true);
        const script = readFileSync(scriptPath, 'utf8');

        expect(script).toContain("PROFILE_AUTHORITY_ALLOW_STAGING_PROVISIONING_VERIFY");
        expect(script).toContain("const STAGING_REF = 'dnzytocmtmnptndeczny'");
        expect(script).toContain("const PRODUCTION_REF = 'gmjgkzaxmkaggsyczwcm'");
        expect(script).toContain("ban_duration: '87600h'");
        expect(script).toContain("zinergia_fixture_purpose: 'post_contract_provisioning'");
        expect(script).toContain('BEGIN;');
        expect(script).toContain('ROLLBACK;');
        expect(script).not.toContain('COMMIT;');
        expect(script).toContain('consume_profile_join_rate_limit');
        expect(script).toContain('begin_profile_invitation_provisioning');
        expect(script).toContain('record_profile_invitation_auth_user');
        expect(script).toContain('finalize_profile_invitation_authority');
        expect(script).toContain('complete_profile_invitation_provisioning');
        expect(script).toContain('verify-expand-concurrency-staging.mjs');
        expect(script).toContain('PROFILE_AUTHORITY_EXPAND_ALLOW_STAGING_CONCURRENCY_VERIFY');
        expect(script).toContain("NODE_PATH: join(process.cwd(), 'node_modules')");
        expect(script).toContain('service.auth.admin.deleteUser');
        expect(script).toContain('STAGING_PROVISIONING_TRANSACTIONAL_OK');
    });
});
