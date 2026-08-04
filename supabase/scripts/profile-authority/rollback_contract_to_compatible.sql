-- ZIN-SDD-041 emergency rollback: contract -> compatible.
--
-- Target state: the environment as it stood after 20260803214216, i.e. expansion applied
-- and the compatible application running. This is NOT a rollback to the pre-ZIN-SDD-041
-- application; that one wrote to public.profiles directly from the browser and is no
-- longer deployed.
--
-- Run this only if 20260803190000 / 191000 / 192000 have been applied and the promotion
-- must be aborted. Apply the whole file in one transaction, as a role that owns the
-- objects (postgres).
--
-- WHAT THIS RESTORES
--   * Drops profiles_authority_tuple_check, so rows that fail the canonical shape stop
--     blocking every write to the row.
--   * Returns private.profile_authority_guard() to compatibility mode: a write without
--     app.profile_authority_context is permitted, bumps authority_version and emits
--     RAISE LOG instead of raising AUTHORITY_CONTEXT_REQUIRED.
--   * Re-grants SELECT (authority_version) to authenticated, matching the post-expansion
--     grant that 191000 revoked.
--
-- WHAT THIS DOES NOT RESTORE, DELIBERATELY
--   * The legacy policies dropped by 190000 ("Admin sees all", "Franchises can see their
--     agents", "Users can see own profile", "Users can update own profile") and by 192000
--     (rls_profiles_auth_select, rls_profiles_auth_update). Their original definitions are
--     not in version control - 192000 exists precisely because they predate the migration
--     source of truth. profiles_directory_select supersedes the read paths and the
--     compatible application does not need the write paths.
--   * Browser INSERT/UPDATE/DELETE on public.profiles. Restoring those would reopen the
--     hole the whole change closes. If a rollback genuinely needs them, that is a separate
--     reviewed decision, not an automatic step.
--
-- AFTER RUNNING
--   Authority changes stop being audited: in compatibility mode
--   audit_profile_authority_change() returns without inserting an event when no context is
--   present. Treat the window as unaudited and reconcile before promoting again.

BEGIN;

-- 1. Remove the shape constraint added by 20260803191000.
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_authority_tuple_check;

-- 2. Restore the concurrency token projection revoked by 20260803191000.
GRANT SELECT (authority_version) ON TABLE public.profiles TO authenticated;

-- 3. Return the guard to compatibility mode. Body copied verbatim from
--    20260803150000_profile_authority_expand.sql; the only difference from the contract
--    version is the empty-context branch below.
CREATE OR REPLACE FUNCTION private.profile_authority_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_context_text text;
    v_context jsonb;
BEGIN
    IF ROW(NEW.role, NEW.parent_id, NEW.franchise_id, NEW.authority_version)
       IS NOT DISTINCT FROM
       ROW(OLD.role, OLD.parent_id, OLD.franchise_id, OLD.authority_version) THEN
        RETURN NEW;
    END IF;

    IF ROW(NEW.role, NEW.parent_id, NEW.franchise_id)
       IS NOT DISTINCT FROM
       ROW(OLD.role, OLD.parent_id, OLD.franchise_id) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_VERSION_PROTECTED';
    END IF;

    v_context_text := current_setting('app.profile_authority_context', true);
    IF v_context_text IS NULL OR v_context_text = '' THEN
        -- Compatibility mode. The contract migration replaces this branch with a hard
        -- rejection; this rollback puts it back.
        NEW.authority_version := OLD.authority_version + 1;
        RAISE LOG 'profile_authority_legacy_write field_class=authority';
        RETURN NEW;
    END IF;

    BEGIN
        v_context := v_context_text::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_CONTEXT_INVALID';
    END;

    IF (v_context->>'target_profile_id')::uuid IS DISTINCT FROM OLD.id
       OR (v_context->>'before_version')::bigint IS DISTINCT FROM OLD.authority_version
       OR (v_context->>'after_version')::bigint IS DISTINCT FROM OLD.authority_version + 1
       OR (v_context->'before_state') IS DISTINCT FROM private.profile_authority_state(
           OLD.role, OLD.parent_id, OLD.franchise_id
       )
       OR (v_context->'after_state') IS DISTINCT FROM private.profile_authority_state(
           NEW.role, NEW.parent_id, NEW.franchise_id
       ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_CONTEXT_MISMATCH';
    END IF;

    NEW.authority_version := OLD.authority_version + 1;
    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION private.profile_authority_guard()
    FROM PUBLIC, anon, authenticated, service_role;

-- 4. Assert the rollback landed, so a partial apply cannot be mistaken for success.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_catalog.pg_constraint
        WHERE conrelid = 'public.profiles'::regclass
          AND conname = 'profiles_authority_tuple_check'
    ) THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'ROLLBACK_INCOMPLETE_TUPLE_CHECK_STILL_PRESENT';
    END IF;

    IF pg_catalog.pg_get_functiondef('private.profile_authority_guard()'::regprocedure)
       NOT ILIKE '%profile_authority_legacy_write%' THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'ROLLBACK_INCOMPLETE_GUARD_STILL_IN_CONTRACT_MODE';
    END IF;
END;
$$;

COMMIT;
