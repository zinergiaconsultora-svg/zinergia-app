import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const contractMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260803190000_contract_profile_boundary.sql'),
    'utf8',
);
const tupleCorrectionMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260803191000_enforce_profile_authority_tuple.sql'),
    'utf8',
);
const legacyPolicyCorrectionMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260803192000_remove_legacy_profile_policies.sql'),
    'utf8',
);
const franchiseOptionalMigration = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260806010000_collaborator_without_franchise.sql'),
    'utf8',
);

describe('ZIN-SDD-041 T16 final profile contract', () => {
    it('removes all browser writes while retaining an explicit directory-only read contract', () => {
        expect(contractMigration).toMatch(
            /REVOKE\s+ALL\s+ON\s+TABLE\s+public\.profiles\s+FROM\s+PUBLIC,\s+anon,\s+authenticated/i,
        );
        expect(contractMigration).toMatch(
            /GRANT\s+SELECT\s*\([\s\S]*?updated_at[\s\S]*?\)\s+ON\s+TABLE\s+public\.profiles\s+TO\s+authenticated/i,
        );
        expect(contractMigration).not.toMatch(/GRANT\s+(?:ALL|UPDATE|INSERT|DELETE)\b[^;]*public\.profiles\s+TO\s+authenticated/i);
        expect(contractMigration).toContain('DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;');
        expect(contractMigration).toContain('CREATE POLICY profiles_directory_select');
        expect(contractMigration).toContain('private.can_read_profile_directory(id)');
        expect(tupleCorrectionMigration).toMatch(/REVOKE\s+SELECT\s*\(authority_version\)[\s\S]*?authenticated/i);
        expect(legacyPolicyCorrectionMigration).toContain('DROP POLICY IF EXISTS rls_profiles_auth_update ON public.profiles;');
    });

    it('changes the authority guard from compatibility mode to fail-closed mode', () => {
        const guard = contractMigration.match(
            /CREATE OR REPLACE FUNCTION private\.profile_authority_guard\(\)[\s\S]*?\$\$;/i,
        )?.[0] ?? '';

        expect(guard).toContain("MESSAGE = 'AUTHORITY_CONTEXT_REQUIRED'");
        expect(guard).not.toContain('profile_authority_legacy_write');
        expect(guard).not.toMatch(/RETURN\s+NEW;\s*--\s*Expansion compatibility/i);
        expect(guard).toContain("SET search_path = ''");
    });

    it('keeps event, provisioning and trigger execution inaccessible to browser roles', () => {
        for (const relation of [
            'profile_authority_events',
            'profile_invitation_provisioning',
            'profile_join_rate_limits',
            'profile_join_rate_limit_receipts',
        ]) {
            expect(contractMigration).toMatch(
                new RegExp(`REVOKE\\s+ALL\\s+ON\\s+TABLE\\s+public\\.${relation}\\s+FROM\\s+PUBLIC,\\s+anon,\\s+authenticated`, 'i'),
            );
        }
        expect(contractMigration).toMatch(/GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.handle_new_user\(\)\s+TO\s+supabase_auth_admin/i);
        expect(contractMigration).not.toMatch(/GRANT\s+EXECUTE[^;]*public\.handle_new_user\(\)[^;]*service_role/i);
    });

    it('persists only complete authority tuple shapes', () => {
        expect(tupleCorrectionMigration).toContain('profiles_authority_tuple_check');
        expect(tupleCorrectionMigration).toMatch(/role\s+IS\s+NULL[\s\S]*?parent_id\s+IS\s+NULL[\s\S]*?franchise_id\s+IS\s+NULL/i);
        expect(tupleCorrectionMigration).toMatch(/role\s*=\s*'admin'[\s\S]*?parent_id\s+IS\s+NULL[\s\S]*?franchise_id\s+IS\s+NULL/i);
        expect(tupleCorrectionMigration).toMatch(/role\s+IN\s*\('franchise',\s*'agent'\)[\s\S]*?parent_id\s+IS\s+NOT\s+NULL[\s\S]*?franchise_id\s+IS\s+NOT\s+NULL/i);
    });
});

/**
 * El modelo pasó a ser un administrador y colaboradores, así que la exigencia de
 * franquicia se relajó. Estos casos existen para que quede claro qué se relajó y,
 * sobre todo, qué NO: la garantía sobre la cuenta de administración es la que
 * impide perder el control de la aplicación, y no se toca al simplificar el
 * modelo.
 */
describe('el colaborador ya no necesita franquicia', () => {
    it('reemplaza la regla en lugar de añadir una segunda', () => {
        expect(franchiseOptionalMigration).toContain('DROP CONSTRAINT IF EXISTS profiles_authority_tuple_check');
        expect(franchiseOptionalMigration).toContain('ADD CONSTRAINT profiles_authority_tuple_check');
    });

    it('mantiene que la administración no cuelga de nadie', () => {
        expect(franchiseOptionalMigration).toMatch(
            /role\s*=\s*'admin'\s+AND\s+parent_id\s+IS\s+NULL\s+AND\s+franchise_id\s+IS\s+NULL/i,
        );
    });

    it('sigue exigiendo las dos cosas a la franquicia mientras el rol exista', () => {
        expect(franchiseOptionalMigration).toMatch(
            /role\s*=\s*'franchise'\s+AND\s+parent_id\s+IS\s+NOT\s+NULL\s+AND\s+franchise_id\s+IS\s+NOT\s+NULL/i,
        );
    });

    // Lo único que cambia: el colaborador conserva el responsable y pierde la
    // exigencia de franquicia.
    it('deja al colaborador con responsable y sin franquicia obligatoria', () => {
        expect(franchiseOptionalMigration).toMatch(/role\s*=\s*'agent'\s+AND\s+parent_id\s+IS\s+NOT\s+NULL\s*\)/i);
        expect(franchiseOptionalMigration).not.toMatch(
            /role\s*=\s*'agent'\s+AND\s+parent_id\s+IS\s+NOT\s+NULL\s+AND\s+franchise_id\s+IS\s+NOT\s+NULL/i,
        );
    });
});
