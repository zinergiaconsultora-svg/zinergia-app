-- ZIN-SDD-041 / T16
-- Final contract after the compatible application and blocked-Auth provisioning
-- gates have passed in staging. This migration deliberately has no data repair
-- path: invalid authority tuples must be fixed through an explicit recovery.

BEGIN;

CREATE OR REPLACE FUNCTION private.can_read_profile_directory(p_target_profile_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_actor public.profiles%ROWTYPE;
    v_target public.profiles%ROWTYPE;
BEGIN
    IF p_target_profile_id IS NULL OR auth.uid() IS NULL THEN
        RETURN false;
    END IF;

    SELECT * INTO v_actor
    FROM public.profiles
    WHERE id = auth.uid();

    SELECT * INTO v_target
    FROM public.profiles
    WHERE id = p_target_profile_id;

    IF v_actor.id IS NULL OR v_target.id IS NULL OR v_actor.role IS NULL THEN
        RETURN false;
    END IF;

    IF v_actor.id = v_target.id THEN
        RETURN true;
    END IF;

    IF v_actor.role = 'admin'
       AND v_actor.parent_id IS NULL
       AND v_actor.franchise_id IS NULL THEN
        RETURN true;
    END IF;

    IF v_actor.role = 'franchise'
       AND v_actor.parent_id IS NOT NULL
       AND v_actor.franchise_id IS NOT NULL
       AND v_target.role = 'agent'
       AND v_target.parent_id = v_actor.id
       AND v_target.franchise_id = v_actor.franchise_id
       AND EXISTS (
           SELECT 1
           FROM public.franchises franchise
           WHERE franchise.id = v_actor.franchise_id
             AND franchise.is_active IS TRUE
       ) THEN
        RETURN true;
    END IF;

    IF v_actor.role = 'agent'
       AND v_actor.parent_id = v_target.id
       AND (
           (v_target.role = 'admin'
            AND v_target.parent_id IS NULL
            AND v_target.franchise_id IS NULL)
           OR
           (v_target.role = 'franchise'
            AND v_target.franchise_id = v_actor.franchise_id
            AND v_target.parent_id IS NOT NULL)
       ) THEN
        RETURN true;
    END IF;

    RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION private.can_read_profile_directory(uuid)
    FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_read_profile_directory(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Admin sees all" ON public.profiles;
DROP POLICY IF EXISTS "Franchises can see their agents" ON public.profiles;
DROP POLICY IF EXISTS "Users can see own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS profiles_directory_select ON public.profiles;

CREATE POLICY profiles_directory_select
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((SELECT private.can_read_profile_directory(id)));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (
    id,
    email,
    full_name,
    phone,
    bio,
    timezone,
    role,
    parent_id,
    franchise_id,
    created_at,
    updated_at,
    authority_version
) ON TABLE public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profiles TO service_role;

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
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_CONTEXT_REQUIRED';
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

REVOKE ALL ON TABLE public.profile_authority_events
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON TABLE public.profile_authority_events TO authenticated;
GRANT SELECT, INSERT ON TABLE public.profile_authority_events TO service_role;

REVOKE ALL ON TABLE public.profile_invitation_provisioning
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_invitation_provisioning TO service_role;

REVOKE ALL ON TABLE public.profile_join_rate_limits
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_join_rate_limits TO service_role;

REVOKE ALL ON TABLE public.profile_join_rate_limit_receipts
    FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.profile_join_rate_limit_receipts TO service_role;

REVOKE ALL ON FUNCTION public.update_own_profile(uuid, text, text, text, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_team_member_name(uuid, uuid, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_profile_authority(uuid, uuid, text, uuid, uuid, bigint, text, uuid)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_profile_join_rate_limit(text, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_profile_join_rate_limit_receipt(uuid, uuid, uuid, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_profile_invitation_provisioning(uuid, text, uuid, uuid, text)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_profile_invitation_auth_user(uuid, uuid, timestamptz)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_profile_invitation_authority(uuid, text, timestamptz)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_profile_invitation_provisioning(uuid, uuid, timestamptz)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_profile_invitation_provisioning(uuid, text, integer)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()
    FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_own_profile(uuid, text, text, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_team_member_name(uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_profile_authority(uuid, uuid, text, uuid, uuid, bigint, text, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.consume_profile_join_rate_limit(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_profile_join_rate_limit_receipt(uuid, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.begin_profile_invitation_provisioning(uuid, text, uuid, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_profile_invitation_auth_user(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_profile_invitation_authority(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.complete_profile_invitation_provisioning(uuid, uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.reconcile_profile_invitation_provisioning(uuid, text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION private.profile_authority_state(text, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION private.finalize_profile_invitation_authority_core(uuid, text, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

COMMENT ON FUNCTION private.can_read_profile_directory(uuid) IS
    'ZIN-SDD-041: boolean-only, row-scoped directory access check for canonical authority relationships.';
COMMENT ON TABLE public.profiles IS
    'ZIN-SDD-041: browser reads are limited to directory/authority columns; every mutation uses a purpose-specific server command.';

COMMIT;
