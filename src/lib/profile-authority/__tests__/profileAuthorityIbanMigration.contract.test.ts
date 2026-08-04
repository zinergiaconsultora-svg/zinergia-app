import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(resolve(
    process.cwd(),
    'supabase/migrations/20260803180000_add_update_own_iban_rpc.sql',
), 'utf8').replace(/\s+/g, ' ');

describe('ZIN-SDD-041 dedicated own-IBAN command', () => {
    it('validates mod-97 and invalidates fiscal approval in the same service-only command', () => {
        expect(migration).toMatch(/CREATE OR REPLACE FUNCTION public\.update_own_iban\s*\(\s*p_actor_id uuid\s*,\s*p_iban text/i);
        expect(migration).toMatch(/SET search_path\s*=\s*''/i);
        expect(migration).toMatch(/v_remainder\s*:=\s*\(v_remainder \* 10 \+ v_character::integer\) % 97/i);
        expect(migration).toMatch(/SET iban\s*=\s*v_iban\s*,\s*fiscal_verified\s*=\s*false\s*,\s*fiscal_verified_at\s*=\s*NULL/i);
        expect(migration).toMatch(/REVOKE ALL ON FUNCTION public\.update_own_iban\s*\(uuid, text\)[^;]+PUBLIC\s*,\s*anon\s*,\s*authenticated/i);
        expect(migration).toMatch(/GRANT EXECUTE ON FUNCTION public\.update_own_iban\s*\(uuid, text\)[^;]+service_role/i);
    });
});
