import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
    process.cwd(),
    'supabase/migrations/20260803170000_restrict_handle_new_user_execute.sql',
), 'utf8').replace(/\s+/g, ' ');

describe('ZIN-SDD-041 handle_new_user execution ACL correction', () => {
    it('removes every application-facing executor and retains only Auth trigger execution', () => {
        expect(migration).toMatch(
            /REVOKE ALL ON FUNCTION public\.handle_new_user\s*\(\s*\) FROM PUBLIC\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role\s*;/i,
        );
        expect(migration).toMatch(
            /GRANT EXECUTE ON FUNCTION public\.handle_new_user\s*\(\s*\) TO supabase_auth_admin\s*;/i,
        );
        expect(migration).not.toMatch(
            /GRANT EXECUTE[^;]+TO\s+(?:PUBLIC|anon|authenticated|service_role)\b/i,
        );
    });
});
