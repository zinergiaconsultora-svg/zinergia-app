-- ZIN-SDD-041 / T4-T5: additive profile authority + invitation provisioning foundation.
-- Pending migration. Do not apply to production before the expand -> compatible app -> contract gates.
--
-- Deliberately specified here because the design leaves exact provisioning signatures open:
-- - public begin/record/finalize/complete/reconcile wrappers are service-role-only SECURITY INVOKER RPCs;
-- - the public route supplies already-peppered SHA-256/HMAC identifiers and Auth ban observations;
-- - Auth operations remain outside PostgreSQL; these records make retries and reconciliation durable;
-- - the profile guard starts in compatibility mode. The later contract migration makes missing
--   canonical context fail closed after every legacy writer has converged.
-- - no canonical Admin currently exists in the reviewed staging preflight; this migration does
--   not guess or backfill one. The first authority recovery remains an explicit reviewed decision.

BEGIN;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS authority_version bigint NOT NULL DEFAULT 0;

ALTER TABLE public.network_invitations
    ADD COLUMN IF NOT EXISTS target_franchise_id uuid;

ALTER TABLE public.network_invitations
    DROP CONSTRAINT IF EXISTS network_invitations_target_franchise_id_fkey;

ALTER TABLE public.network_invitations
    ADD CONSTRAINT network_invitations_target_franchise_id_fkey
    FOREIGN KEY (target_franchise_id)
    REFERENCES public.franchises(id)
    ON UPDATE RESTRICT
    ON DELETE RESTRICT
    NOT VALID;

-- The column was introduced immediately above, so every legacy row is NULL and validation
-- performs no authority inference or data rewrite.
ALTER TABLE public.network_invitations
    VALIDATE CONSTRAINT network_invitations_target_franchise_id_fkey;

CREATE TABLE public.profile_authority_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL,
    target_profile_id uuid NOT NULL,
    event_type text NOT NULL,
    reason_code text NOT NULL,
    before_state jsonb NOT NULL,
    after_state jsonb NOT NULL,
    request_id uuid NOT NULL,
    before_version bigint NOT NULL,
    after_version bigint NOT NULL,
    source_type text,
    source_id uuid,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT profile_authority_events_request_id_key UNIQUE (request_id),
    CONSTRAINT profile_authority_events_event_type_check CHECK (
        event_type IN ('authority_changed', 'invitation_authority_committed')
    ),
    CONSTRAINT profile_authority_events_reason_code_check CHECK (
        reason_code IN (
            'role_change',
            'franchise_assignment',
            'franchise_removal',
            'deactivation',
            'reactivation',
            'invitation_acceptance',
            'authority_correction',
            'security_recovery'
        )
    ),
    CONSTRAINT profile_authority_events_version_check CHECK (
        before_version >= 0 AND after_version = before_version + 1
    ),
    CONSTRAINT profile_authority_events_source_check CHECK (
        (source_type IS NULL AND source_id IS NULL)
        OR (source_type IN ('network_invitation', 'provisioning') AND source_id IS NOT NULL)
    ),
    CONSTRAINT profile_authority_events_before_state_check CHECK (
        jsonb_typeof(before_state) = 'object'
        AND (before_state - ARRAY['role', 'parent_id', 'franchise_id']::text[]) = '{}'::jsonb
        AND before_state ?& ARRAY['role', 'parent_id', 'franchise_id']::text[]
    ),
    CONSTRAINT profile_authority_events_after_state_check CHECK (
        jsonb_typeof(after_state) = 'object'
        AND (after_state - ARRAY['role', 'parent_id', 'franchise_id']::text[]) = '{}'::jsonb
        AND after_state ?& ARRAY['role', 'parent_id', 'franchise_id']::text[]
    )
);

CREATE INDEX profile_authority_events_target_created_idx
    ON public.profile_authority_events (target_profile_id, created_at DESC);

CREATE INDEX profile_authority_events_actor_created_idx
    ON public.profile_authority_events (actor_id, created_at DESC);

CREATE TABLE public.profile_invitation_provisioning (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    invitation_id uuid NOT NULL,
    request_id uuid NOT NULL,
    auth_user_id uuid,
    status text NOT NULL DEFAULT 'prepared',
    banned_until timestamptz,
    safe_error_code text,
    attempt_count integer NOT NULL DEFAULT 0,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    last_attempt_at timestamptz,
    authority_committed_at timestamptz,
    completed_at timestamptz,
    CONSTRAINT profile_invitation_provisioning_invitation_id_key UNIQUE (invitation_id),
    CONSTRAINT profile_invitation_provisioning_request_id_key UNIQUE (request_id),
    CONSTRAINT profile_invitation_provisioning_auth_user_id_key UNIQUE (auth_user_id),
    CONSTRAINT profile_invitation_provisioning_invitation_id_fkey
        FOREIGN KEY (invitation_id)
        REFERENCES public.network_invitations(id)
        ON UPDATE RESTRICT
        ON DELETE RESTRICT,
    CONSTRAINT profile_invitation_provisioning_status_check CHECK (
        status IN (
            'prepared',
            'auth_created_blocked',
            'authority_committed',
            'completed',
            'needs_reconciliation'
        )
    ),
    CONSTRAINT profile_invitation_provisioning_safe_error_check CHECK (
        safe_error_code IS NULL OR safe_error_code IN (
            'auth_user_conflict',
            'auth_lookup_mismatch',
            'unban_failed',
            'cleanup_unsafe',
            'state_inconsistent',
            'retry_exhausted'
        )
    ),
    CONSTRAINT profile_invitation_provisioning_attempt_count_check CHECK (attempt_count >= 0),
    CONSTRAINT profile_invitation_provisioning_state_shape_check CHECK (
        (status = 'prepared' AND auth_user_id IS NULL AND banned_until IS NULL)
        OR (
            status = 'auth_created_blocked'
            AND auth_user_id IS NOT NULL
            AND banned_until IS NOT NULL
            AND authority_committed_at IS NULL
            AND safe_error_code IS NULL
        )
        OR (
            status = 'needs_reconciliation'
            AND safe_error_code IS NOT NULL
            AND (
                auth_user_id IS NOT NULL
                OR (
                    auth_user_id IS NULL
                    AND safe_error_code IN ('auth_user_conflict', 'auth_lookup_mismatch')
                )
            )
        )
        OR (
            status = 'authority_committed'
            AND auth_user_id IS NOT NULL
            AND banned_until IS NOT NULL
            AND authority_committed_at IS NOT NULL
            AND safe_error_code IS NULL
        )
        OR (
            status = 'completed'
            AND auth_user_id IS NOT NULL
            AND banned_until IS NULL
            AND authority_committed_at IS NOT NULL
            AND safe_error_code IS NULL
        )
    ),
    CONSTRAINT profile_invitation_provisioning_completed_shape_check CHECK (
        (status = 'completed' AND completed_at IS NOT NULL)
        OR (status <> 'completed' AND completed_at IS NULL)
    )
);

CREATE INDEX profile_invitation_provisioning_reconcile_idx
    ON public.profile_invitation_provisioning (status, updated_at)
    WHERE status <> 'completed';

CREATE TABLE public.profile_join_rate_limits (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    scope_type text NOT NULL,
    identifier_hash text NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
    CONSTRAINT profile_join_rate_limits_scope_check CHECK (
        scope_type IN ('source_invitation', 'invitation_email')
    ),
    CONSTRAINT profile_join_rate_limits_identifier_hash_check CHECK (
        identifier_hash ~ '^[0-9a-f]{64,128}$'
    ),
    CONSTRAINT profile_join_rate_limits_expiry_check CHECK (expires_at > occurred_at)
);

CREATE INDEX profile_join_rate_limits_lookup_idx
    ON public.profile_join_rate_limits (scope_type, identifier_hash, occurred_at DESC);

CREATE INDEX profile_join_rate_limits_expires_idx
    ON public.profile_join_rate_limits (expires_at);

CREATE TABLE public.profile_join_rate_limit_receipts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    source_key_hash text NOT NULL,
    identity_key_hash text NOT NULL,
    invitation_id uuid,
    request_id uuid,
    payload_hash text,
    issued_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
    claimed_at timestamptz,
    CONSTRAINT profile_join_rate_limit_receipts_source_hash_check CHECK (
        source_key_hash ~ '^[0-9a-f]{64,128}$'
    ),
    CONSTRAINT profile_join_rate_limit_receipts_identity_hash_check CHECK (
        identity_key_hash ~ '^[0-9a-f]{64,128}$'
    ),
    CONSTRAINT profile_join_rate_limit_receipts_payload_hash_check CHECK (
        payload_hash IS NULL OR payload_hash ~ '^[0-9a-f]{64,128}$'
    ),
    CONSTRAINT profile_join_rate_limit_receipts_expiry_check CHECK (expires_at > issued_at),
    CONSTRAINT profile_join_rate_limit_receipts_claim_shape_check CHECK (
        (
            claimed_at IS NULL
            AND invitation_id IS NULL
            AND request_id IS NULL
            AND payload_hash IS NULL
        ) OR (
            claimed_at IS NOT NULL
            AND invitation_id IS NOT NULL
            AND request_id IS NOT NULL
            AND payload_hash IS NOT NULL
        )
    )
);

CREATE INDEX profile_join_rate_limit_receipts_expires_idx
    ON public.profile_join_rate_limit_receipts (expires_at);

ALTER TABLE public.profile_authority_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_invitation_provisioning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_join_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_join_rate_limit_receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY profile_authority_events_admin_select
    ON public.profile_authority_events
    FOR SELECT
    TO authenticated
    USING ((SELECT private.is_admin()));

REVOKE ALL ON public.profile_authority_events FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.profile_authority_events TO authenticated;
GRANT SELECT, INSERT ON public.profile_authority_events TO service_role;

REVOKE ALL ON public.profile_invitation_provisioning FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_invitation_provisioning TO service_role;

REVOKE ALL ON public.profile_join_rate_limits FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_join_rate_limits TO service_role;

REVOKE ALL ON public.profile_join_rate_limit_receipts FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_join_rate_limit_receipts TO service_role;

CREATE OR REPLACE FUNCTION private.prevent_profile_authority_event_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RAISE EXCEPTION USING
        ERRCODE = 'P0001',
        MESSAGE = 'AUTHORITY_EVENT_IMMUTABLE';
END;
$$;

DROP TRIGGER IF EXISTS profile_authority_events_reject_update_delete
    ON public.profile_authority_events;

CREATE TRIGGER profile_authority_events_reject_update_delete
    BEFORE UPDATE OR DELETE ON public.profile_authority_events
    FOR EACH ROW
    EXECUTE FUNCTION private.prevent_profile_authority_event_mutation();

DROP TRIGGER IF EXISTS profile_authority_events_reject_truncate
    ON public.profile_authority_events;

CREATE TRIGGER profile_authority_events_reject_truncate
    BEFORE TRUNCATE ON public.profile_authority_events
    FOR EACH STATEMENT
    EXECUTE FUNCTION private.prevent_profile_authority_event_mutation();

CREATE OR REPLACE FUNCTION private.profile_authority_state(
    p_role text,
    p_parent_id uuid,
    p_franchise_id uuid
)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = ''
AS $$
    SELECT jsonb_build_object(
        'role', p_role,
        'parent_id', p_parent_id,
        'franchise_id', p_franchise_id
    );
$$;

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
        -- Expansion compatibility mode. T16 replaces this branch with a hard rejection.
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

CREATE OR REPLACE FUNCTION private.audit_profile_authority_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_context_text text;
    v_context jsonb;
BEGIN
    IF ROW(NEW.role, NEW.parent_id, NEW.franchise_id)
       IS NOT DISTINCT FROM
       ROW(OLD.role, OLD.parent_id, OLD.franchise_id) THEN
        RETURN NEW;
    END IF;

    v_context_text := current_setting('app.profile_authority_context', true);
    IF v_context_text IS NULL OR v_context_text = '' THEN
        RETURN NEW;
    END IF;
    v_context := v_context_text::jsonb;

    INSERT INTO public.profile_authority_events (
        id,
        actor_id,
        target_profile_id,
        event_type,
        reason_code,
        before_state,
        after_state,
        request_id,
        before_version,
        after_version,
        source_type,
        source_id
    ) VALUES (
        (v_context->>'event_id')::uuid,
        (v_context->>'actor_id')::uuid,
        OLD.id,
        v_context->>'event_type',
        v_context->>'reason_code',
        private.profile_authority_state(OLD.role, OLD.parent_id, OLD.franchise_id),
        private.profile_authority_state(NEW.role, NEW.parent_id, NEW.franchise_id),
        (v_context->>'request_id')::uuid,
        OLD.authority_version,
        NEW.authority_version,
        nullif(v_context->>'source_type', ''),
        nullif(v_context->>'source_id', '')::uuid
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_authority_guard ON public.profiles;
CREATE TRIGGER profiles_authority_guard
    BEFORE UPDATE OF role, parent_id, franchise_id, authority_version
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION private.profile_authority_guard();

DROP TRIGGER IF EXISTS profiles_authority_audit ON public.profiles;
CREATE TRIGGER profiles_authority_audit
    AFTER UPDATE OF role, parent_id, franchise_id, authority_version
    ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION private.audit_profile_authority_change();

CREATE OR REPLACE FUNCTION public.update_own_profile(
    p_actor_id uuid,
    p_full_name text,
    p_phone text,
    p_bio text DEFAULT NULL,
    p_timezone text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_actor public.profiles%ROWTYPE;
BEGIN
    IF p_actor_id IS NULL OR nullif(btrim(p_full_name), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROFILE_INPUT_INVALID';
    END IF;

    SELECT * INTO v_actor
    FROM public.profiles
    WHERE id = p_actor_id
    FOR UPDATE;

    IF NOT FOUND OR NOT (
        (v_actor.role IS NOT DISTINCT FROM 'admin' AND v_actor.parent_id IS NULL AND v_actor.franchise_id IS NULL)
        OR (
            v_actor.role IS NOT NULL
            AND v_actor.role IN ('franchise', 'agent')
            AND v_actor.franchise_id IS NOT NULL
            AND EXISTS (
                SELECT 1 FROM public.franchises f
                WHERE f.id = v_actor.franchise_id AND f.is_active IS TRUE
            )
        )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_NOT_ACTIVE';
    END IF;

    UPDATE public.profiles AS profile
    SET full_name = btrim(p_full_name),
        phone = p_phone,
        bio = coalesce(p_bio, bio),
        timezone = coalesce(nullif(btrim(p_timezone), ''), timezone)
    WHERE id = p_actor_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_team_member_name(
    p_actor_id uuid,
    p_target_id uuid,
    p_full_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_actor public.profiles%ROWTYPE;
    v_target public.profiles%ROWTYPE;
BEGIN
    IF p_actor_id IS NULL OR p_target_id IS NULL OR p_actor_id = p_target_id
       OR nullif(btrim(p_full_name), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TEAM_MEMBER_INPUT_INVALID';
    END IF;

    -- Serialize profile row acquisition with every authority/finalization path.
    PERFORM pg_advisory_xact_lock(hashtextextended('profile-authority-canonical', 0));

    PERFORM 1 FROM public.profiles
    WHERE id IN (p_actor_id, p_target_id)
    ORDER BY id
    FOR UPDATE;

    SELECT * INTO v_actor FROM public.profiles WHERE id = p_actor_id;
    SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id;

    IF v_actor.id IS NULL OR v_target.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACCOUNT_NOT_ACTIVE';
    END IF;

    IF NOT (
        (v_actor.role IS NOT DISTINCT FROM 'admin' AND v_actor.parent_id IS NULL AND v_actor.franchise_id IS NULL)
        OR (
            v_actor.role IS NOT DISTINCT FROM 'franchise'
            AND v_actor.franchise_id IS NOT NULL
            AND v_target.role IS NOT DISTINCT FROM 'agent'
            AND v_target.parent_id IS NOT DISTINCT FROM v_actor.id
            AND v_target.franchise_id IS NOT DISTINCT FROM v_actor.franchise_id
            AND EXISTS (
                SELECT 1 FROM public.franchises f
                WHERE f.id = v_actor.franchise_id AND f.is_active IS TRUE
            )
        )
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TEAM_MEMBER_SCOPE_DENIED';
    END IF;

    UPDATE public.profiles AS profile
    SET full_name = btrim(p_full_name)
    WHERE id = p_target_id
      AND (
          v_actor.role IS NOT DISTINCT FROM 'admin'
          OR (
              role IS NOT DISTINCT FROM 'agent'
              AND parent_id IS NOT DISTINCT FROM p_actor_id
              AND franchise_id IS NOT DISTINCT FROM v_actor.franchise_id
          )
      );

    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TEAM_MEMBER_SCOPE_CHANGED';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.change_profile_authority(
    p_actor_id uuid,
    p_target_id uuid,
    p_desired_role text,
    p_parent_id uuid,
    p_franchise_id uuid,
    p_expected_authority_version bigint,
    p_reason_code text,
    p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_actor public.profiles%ROWTYPE;
    v_target public.profiles%ROWTYPE;
    v_parent public.profiles%ROWTYPE;
    v_parent_admin public.profiles%ROWTYPE;
    v_franchise public.franchises%ROWTYPE;
    v_existing public.profile_authority_events%ROWTYPE;
    v_after_state jsonb;
    v_event_id uuid := gen_random_uuid();
    v_context jsonb;
BEGIN
    IF p_actor_id IS NULL OR p_target_id IS NULL OR p_request_id IS NULL
       OR p_expected_authority_version IS NULL OR p_reason_code IS NULL
       OR p_actor_id = p_target_id
       OR p_reason_code NOT IN (
           'role_change', 'franchise_assignment', 'franchise_removal', 'deactivation',
           'reactivation', 'invitation_acceptance', 'authority_correction', 'security_recovery'
       )
       OR (p_desired_role IS NOT NULL AND p_desired_role NOT IN ('admin', 'franchise', 'agent')) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_INPUT_INVALID';
    END IF;

    v_after_state := private.profile_authority_state(p_desired_role, p_parent_id, p_franchise_id);
    SELECT * INTO v_existing
    FROM public.profile_authority_events
    WHERE request_id = p_request_id;
    IF FOUND THEN
        IF v_existing.actor_id IS DISTINCT FROM p_actor_id
           OR v_existing.target_profile_id IS DISTINCT FROM p_target_id
           OR v_existing.reason_code IS DISTINCT FROM p_reason_code
           OR v_existing.event_type IS DISTINCT FROM 'authority_changed'
           OR v_existing.before_version IS DISTINCT FROM p_expected_authority_version
           OR v_existing.after_state IS DISTINCT FROM v_after_state
           OR v_existing.source_type IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ID_CONFLICT';
        END IF;
    END IF;

    -- One global transaction lock serializes last-Admin and hierarchy-cycle decisions.
    PERFORM pg_advisory_xact_lock(hashtextextended('profile-authority-canonical', 0));
    IF EXISTS (
        SELECT 1
        FROM public.profile_invitation_provisioning p
        WHERE p.request_id = p_request_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ID_CONFLICT';
    END IF;
    -- Recheck inside the lock: a concurrent equal request must return the stable event,
    -- while semantic request-id reuse remains a conflict rather than a unique violation.
    SELECT * INTO v_existing
    FROM public.profile_authority_events
    WHERE request_id = p_request_id;
    IF FOUND THEN
        IF v_existing.actor_id IS DISTINCT FROM p_actor_id
           OR v_existing.target_profile_id IS DISTINCT FROM p_target_id
           OR v_existing.reason_code IS DISTINCT FROM p_reason_code
           OR v_existing.event_type IS DISTINCT FROM 'authority_changed'
           OR v_existing.before_version IS DISTINCT FROM p_expected_authority_version
           OR v_existing.after_state IS DISTINCT FROM v_after_state
           OR v_existing.source_type IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ID_CONFLICT';
        END IF;
        RETURN jsonb_build_object('event_id', v_existing.id);
    END IF;

    PERFORM 1 FROM public.profiles
    WHERE id IN (p_actor_id, p_target_id)
    ORDER BY id
    FOR UPDATE;
    SELECT * INTO v_actor FROM public.profiles WHERE id = p_actor_id;
    SELECT * INTO v_target FROM public.profiles WHERE id = p_target_id;

    IF v_actor.id IS NULL OR v_actor.role IS DISTINCT FROM 'admin'
       OR v_actor.parent_id IS NOT NULL OR v_actor.franchise_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'ACTOR_NOT_ADMIN';
    END IF;
    IF v_target.id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TARGET_NOT_FOUND';
    END IF;
    IF v_target.authority_version <> p_expected_authority_version THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'STALE_AUTHORITY_VERSION';
    END IF;

    IF p_desired_role IS NULL AND p_parent_id IS NULL AND p_franchise_id IS NULL THEN
        NULL;
    ELSIF p_desired_role = 'admin' AND p_parent_id IS NULL AND p_franchise_id IS NULL THEN
        NULL;
    ELSIF p_desired_role IN ('agent', 'franchise') THEN
        IF p_parent_id IS NULL OR p_franchise_id IS NULL OR p_parent_id = p_target_id THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_TUPLE_INVALID';
        END IF;
        SELECT * INTO v_franchise
        FROM public.franchises f
        WHERE f.id = p_franchise_id
        FOR UPDATE;
        IF v_franchise.id IS NULL OR v_franchise.is_active IS NOT TRUE
           OR NOT EXISTS (
               SELECT 1 FROM public.franchises f
               WHERE f.id = p_franchise_id AND f.is_active IS TRUE
           ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_TUPLE_INVALID';
        END IF;
        SELECT * INTO v_parent
        FROM public.profiles
        WHERE id = p_parent_id
        FOR UPDATE;
        IF v_parent.id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_PARENT_INVALID';
        END IF;
        IF p_desired_role = 'franchise' THEN
            IF v_parent.role IS DISTINCT FROM 'admin'
               OR v_parent.parent_id IS NOT NULL OR v_parent.franchise_id IS NOT NULL THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_PARENT_INVALID';
            END IF;
        ELSIF v_parent.role IS NOT DISTINCT FROM 'admin'
              AND v_parent.parent_id IS NULL AND v_parent.franchise_id IS NULL THEN
            NULL;
        ELSIF v_parent.role IS NOT DISTINCT FROM 'franchise'
              AND v_parent.parent_id IS NOT NULL
              AND v_parent.franchise_id = p_franchise_id THEN
            SELECT * INTO v_parent_admin
            FROM public.profiles
            WHERE id = v_parent.parent_id
            FOR UPDATE;
            IF v_parent_admin.id IS NULL
               OR v_parent_admin.role IS DISTINCT FROM 'admin'
               OR v_parent_admin.parent_id IS NOT NULL
               OR v_parent_admin.franchise_id IS NOT NULL THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_PARENT_INVALID';
            END IF;
        ELSE
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_PARENT_INVALID';
        END IF;

        IF EXISTS (
            WITH RECURSIVE ancestors AS (
                SELECT p.id, p.parent_id, ARRAY[p.id]::uuid[] AS path
                FROM public.profiles p
                WHERE p.id = p_parent_id
                UNION ALL
                SELECT p.id, p.parent_id, a.path || p.id
                FROM public.profiles p
                JOIN ancestors a ON p.id = a.parent_id
                WHERE NOT p.id = ANY(a.path)
            )
            SELECT 1 FROM ancestors WHERE id = p_target_id
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_CYCLE';
        END IF;
    ELSE
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTHORITY_TUPLE_INVALID';
    END IF;

    IF v_target.role = 'admin' AND p_desired_role IS DISTINCT FROM 'admin' THEN
        PERFORM 1 FROM public.profiles
        WHERE role = 'admin' AND parent_id IS NULL AND franchise_id IS NULL
        ORDER BY id
        FOR UPDATE;
        IF (SELECT count(*) FROM public.profiles
            WHERE role = 'admin' AND parent_id IS NULL AND franchise_id IS NULL) <= 1 THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LAST_ADMIN';
        END IF;
    END IF;

    v_context := jsonb_build_object(
        'event_id', v_event_id,
        'actor_id', p_actor_id,
        'target_profile_id', p_target_id,
        'event_type', 'authority_changed',
        'reason_code', p_reason_code,
        'request_id', p_request_id,
        'before_version', v_target.authority_version,
        'after_version', v_target.authority_version + 1,
        'before_state', private.profile_authority_state(v_target.role, v_target.parent_id, v_target.franchise_id),
        'after_state', v_after_state,
        'source_type', NULL,
        'source_id', NULL
    );

    PERFORM set_config('app.profile_authority_context', v_context::text, true);
    UPDATE public.profiles AS profile
    SET role = p_desired_role,
        parent_id = p_parent_id,
        franchise_id = p_franchise_id,
        authority_version = authority_version + 1
    WHERE id = p_target_id;
    PERFORM set_config('app.profile_authority_context', '', true);

    RETURN jsonb_build_object('event_id', v_event_id);
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.profile_authority_context', '', true);
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION private.finalize_profile_invitation_authority_core(
    p_provisioning_id uuid,
    p_full_name text,
    p_observed_banned_until timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_provisioning public.profile_invitation_provisioning%ROWTYPE;
    v_invitation public.network_invitations%ROWTYPE;
    v_creator public.profiles%ROWTYPE;
    v_creator_parent public.profiles%ROWTYPE;
    v_target public.profiles%ROWTYPE;
    v_franchise public.franchises%ROWTYPE;
    v_desired_role text;
    v_parent_id uuid;
    v_franchise_id uuid;
    v_event_id uuid := gen_random_uuid();
    v_context jsonb;
BEGIN
    IF p_provisioning_id IS NULL OR nullif(btrim(p_full_name), '') IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_INPUT_INVALID';
    END IF;

    -- This global transaction lock is deliberately the first lock acquired by finalization.
    PERFORM pg_advisory_xact_lock(hashtextextended('profile-authority-canonical', 0));

    SELECT * INTO v_provisioning
    FROM public.profile_invitation_provisioning
    WHERE id = p_provisioning_id
    FOR UPDATE;
    IF NOT FOUND OR v_provisioning.auth_user_id IS NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_NOT_FOUND';
    END IF;
    IF v_provisioning.status IN ('authority_committed', 'completed') THEN
        SELECT id INTO v_event_id
        FROM public.profile_authority_events
        WHERE request_id = v_provisioning.request_id;
        IF v_event_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_STATE_INVALID';
        END IF;
        RETURN jsonb_build_object('event_id', v_event_id, 'status', v_provisioning.status);
    END IF;
    IF v_provisioning.status <> 'auth_created_blocked'
       OR v_provisioning.banned_until IS NULL
       OR v_provisioning.banned_until <= now()
       OR p_observed_banned_until IS NULL
       OR p_observed_banned_until <= now()
       OR v_provisioning.banned_until IS DISTINCT FROM p_observed_banned_until THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTH_USER_NOT_BLOCKED';
    END IF;

    SELECT * INTO v_invitation
    FROM public.network_invitations
    WHERE id = v_provisioning.invitation_id
    FOR UPDATE;
    IF NOT FOUND OR v_invitation.used IS TRUE OR v_invitation.expires_at IS NULL
       OR v_invitation.expires_at <= now()
       THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_INVALID';
    END IF;

    SELECT * INTO v_creator
    FROM public.profiles
    WHERE id = v_invitation.creator_id
    FOR UPDATE;
    SELECT * INTO v_target
    FROM public.profiles
    WHERE id = v_provisioning.auth_user_id
    FOR UPDATE;
    IF v_target.id IS NULL
       OR lower(btrim(coalesce(v_target.email, ''))) IS DISTINCT FROM lower(btrim(v_invitation.email))
       OR v_target.role IS NOT NULL OR v_target.parent_id IS NOT NULL OR v_target.franchise_id IS NOT NULL THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TARGET_NOT_NEUTRAL';
    END IF;

    IF v_creator.role = 'admin' AND v_creator.parent_id IS NULL AND v_creator.franchise_id IS NULL THEN
        IF v_invitation.role NOT IN ('agent', 'franchise')
           OR v_invitation.target_franchise_id IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_AUTHORITY_INVALID';
        END IF;
        SELECT * INTO v_franchise
        FROM public.franchises f
        WHERE f.id = v_invitation.target_franchise_id
        FOR UPDATE;
        IF v_franchise.id IS NULL OR v_franchise.is_active IS NOT TRUE THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_AUTHORITY_INVALID';
        END IF;
        v_desired_role := v_invitation.role;
        v_parent_id := v_creator.id;
        v_franchise_id := v_invitation.target_franchise_id;
    ELSIF v_creator.role = 'franchise'
          AND v_creator.parent_id IS NOT NULL
          AND v_creator.franchise_id IS NOT NULL
          AND v_invitation.role = 'agent'
          AND v_invitation.target_franchise_id IS NULL THEN
        SELECT * INTO v_franchise
        FROM public.franchises f
        WHERE f.id = v_creator.franchise_id
        FOR UPDATE;
        SELECT * INTO v_creator_parent
        FROM public.profiles
        WHERE id = v_creator.parent_id
        FOR UPDATE;
        IF v_franchise.id IS NULL OR v_franchise.is_active IS NOT TRUE
           OR v_creator_parent.id IS NULL
           OR v_creator_parent.role IS DISTINCT FROM 'admin'
           OR v_creator_parent.parent_id IS NOT NULL
           OR v_creator_parent.franchise_id IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_AUTHORITY_INVALID';
        END IF;
        v_desired_role := 'agent';
        v_parent_id := v_creator.id;
        v_franchise_id := v_creator.franchise_id;
    ELSE
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_AUTHORITY_INVALID';
    END IF;

    v_context := jsonb_build_object(
        'event_id', v_event_id,
        'actor_id', v_creator.id,
        'target_profile_id', v_target.id,
        'event_type', 'invitation_authority_committed',
        'reason_code', 'invitation_acceptance',
        'request_id', v_provisioning.request_id,
        'before_version', v_target.authority_version,
        'after_version', v_target.authority_version + 1,
        'before_state', private.profile_authority_state(v_target.role, v_target.parent_id, v_target.franchise_id),
        'after_state', private.profile_authority_state(v_desired_role, v_parent_id, v_franchise_id),
        'source_type', 'network_invitation',
        'source_id', v_invitation.id
    );

    PERFORM set_config('app.profile_authority_context', v_context::text, true);
    UPDATE public.profiles AS profile
    SET full_name = btrim(p_full_name),
        role = v_desired_role,
        parent_id = v_parent_id,
        franchise_id = v_franchise_id,
        authority_version = authority_version + 1
    WHERE id = v_target.id
      AND role IS NULL AND parent_id IS NULL AND franchise_id IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'TARGET_NOT_NEUTRAL';
    END IF;
    PERFORM set_config('app.profile_authority_context', '', true);

    UPDATE public.network_invitations
    SET used = true
    WHERE id = v_invitation.id AND used IS NOT TRUE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_ALREADY_USED';
    END IF;

    UPDATE public.profile_invitation_provisioning
    SET status = 'authority_committed',
        authority_committed_at = now(),
        updated_at = now(),
        last_attempt_at = now(),
        attempt_count = attempt_count + 1,
        safe_error_code = NULL
    WHERE id = v_provisioning.id;

    RETURN jsonb_build_object('event_id', v_event_id, 'status', 'authority_committed');
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.profile_authority_context', '', true);
    RAISE;
END;
$$;

CREATE OR REPLACE FUNCTION public.finalize_profile_invitation_authority(
    p_provisioning_id uuid,
    p_full_name text,
    p_observed_banned_until timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    RETURN private.finalize_profile_invitation_authority_core(
        p_provisioning_id,
        p_full_name,
        p_observed_banned_until
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_profile_join_rate_limit(
    p_source_key_hash text,
    p_identity_key_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_now timestamptz := now();
    v_receipt_id uuid := gen_random_uuid();
BEGIN
    IF p_source_key_hash IS NULL OR p_identity_key_hash IS NULL
       OR p_source_key_hash !~ '^[0-9a-f]{64,128}$'
       OR p_identity_key_hash !~ '^[0-9a-f]{64,128}$' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RATE_LIMIT_INPUT_INVALID';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('source_invitation:' || p_source_key_hash, 0));
    PERFORM pg_advisory_xact_lock(hashtextextended('invitation_email:' || p_identity_key_hash, 0));
    IF (SELECT count(*) FROM public.profile_join_rate_limits
        WHERE scope_type = 'source_invitation'
          AND identifier_hash = p_source_key_hash
          AND occurred_at > v_now - interval '10 minutes') >= 10
       OR (SELECT count(*) FROM public.profile_join_rate_limits
           WHERE scope_type = 'invitation_email'
             AND identifier_hash = p_identity_key_hash
             AND occurred_at > v_now - interval '30 minutes') >= 5 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RATE_LIMITED';
    END IF;

    INSERT INTO public.profile_join_rate_limits (scope_type, identifier_hash, occurred_at, expires_at)
    VALUES
        ('source_invitation', p_source_key_hash, v_now, v_now + interval '24 hours'),
        ('invitation_email', p_identity_key_hash, v_now, v_now + interval '24 hours');

    INSERT INTO public.profile_join_rate_limit_receipts (
        id,
        source_key_hash,
        identity_key_hash,
        issued_at,
        expires_at
    ) VALUES (
        v_receipt_id,
        p_source_key_hash,
        p_identity_key_hash,
        v_now,
        v_now + interval '10 minutes'
    );

    RETURN jsonb_build_object('allowed', true, 'receipt_id', v_receipt_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_profile_join_rate_limit_receipt(
    p_receipt_id uuid,
    p_invitation_id uuid,
    p_request_id uuid,
    p_payload_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_receipt public.profile_join_rate_limit_receipts%ROWTYPE;
BEGIN
    IF p_receipt_id IS NULL OR p_invitation_id IS NULL OR p_request_id IS NULL
       OR p_payload_hash IS NULL
       OR p_payload_hash !~ '^[0-9a-f]{64,128}$' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RATE_LIMIT_RECEIPT_INPUT_INVALID';
    END IF;

    SELECT * INTO v_receipt
    FROM public.profile_join_rate_limit_receipts
    WHERE id = p_receipt_id
    FOR UPDATE;
    IF NOT FOUND OR v_receipt.expires_at <= now() THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RATE_LIMIT_RECEIPT_INVALID';
    END IF;

    IF v_receipt.claimed_at IS NOT NULL THEN
        IF v_receipt.invitation_id IS DISTINCT FROM p_invitation_id
           OR v_receipt.request_id IS DISTINCT FROM p_request_id
           OR v_receipt.payload_hash IS DISTINCT FROM p_payload_hash THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RATE_LIMIT_RECEIPT_CONFLICT';
        END IF;
        RETURN jsonb_build_object('receipt_id', v_receipt.id, 'claimed', true);
    END IF;

    UPDATE public.profile_join_rate_limit_receipts
    SET invitation_id = p_invitation_id,
        request_id = p_request_id,
        payload_hash = p_payload_hash,
        claimed_at = now()
    WHERE id = p_receipt_id AND claimed_at IS NULL;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RATE_LIMIT_RECEIPT_CONFLICT';
    END IF;

    RETURN jsonb_build_object('receipt_id', p_receipt_id, 'claimed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.begin_profile_invitation_provisioning(
    p_invitation_id uuid,
    p_expected_email text,
    p_request_id uuid,
    p_rate_limit_receipt_id uuid,
    p_payload_hash text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_invitation public.network_invitations%ROWTYPE;
    v_creator public.profiles%ROWTYPE;
    v_creator_parent public.profiles%ROWTYPE;
    v_franchise public.franchises%ROWTYPE;
    v_receipt public.profile_join_rate_limit_receipts%ROWTYPE;
    v_existing public.profile_invitation_provisioning%ROWTYPE;
    v_has_exact_authority_event boolean := false;
    v_id uuid := gen_random_uuid();
    v_now timestamptz := now();
BEGIN
    IF p_invitation_id IS NULL OR p_request_id IS NULL OR p_rate_limit_receipt_id IS NULL
       OR nullif(btrim(p_expected_email), '') IS NULL
       OR p_payload_hash IS NULL OR p_payload_hash !~ '^[0-9a-f]{64,128}$' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_INPUT_INVALID';
    END IF;

    -- The rate-limit RPC is a separate committed call. This begin transaction never
    -- claims that a later validation error can preserve its own writes.
    PERFORM pg_advisory_xact_lock(hashtextextended('profile-authority-canonical', 0));

    SELECT * INTO v_receipt
    FROM public.profile_join_rate_limit_receipts
    WHERE id = p_rate_limit_receipt_id
    FOR UPDATE;
    IF NOT FOUND
       OR v_receipt.claimed_at IS NULL
       OR v_receipt.expires_at <= v_now
       OR v_receipt.invitation_id IS DISTINCT FROM p_invitation_id
       OR v_receipt.request_id IS DISTINCT FROM p_request_id
       OR v_receipt.payload_hash IS DISTINCT FROM p_payload_hash THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RATE_LIMIT_RECEIPT_INVALID';
    END IF;

    -- Keep the shared order global advisory -> provisioning -> invitation.
    SELECT * INTO v_existing
    FROM public.profile_invitation_provisioning
    WHERE invitation_id = p_invitation_id
    FOR UPDATE;

    SELECT * INTO v_invitation
    FROM public.network_invitations
    WHERE id = p_invitation_id
    FOR UPDATE;
    IF NOT FOUND
       OR lower(btrim(v_invitation.email)) IS DISTINCT FROM lower(btrim(p_expected_email)) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_INVALID';
    END IF;

    IF v_existing.id IS NOT NULL THEN
        -- needs_reconciliation may be either side of authority commit. Immutable event
        -- evidence plus the commit marker, rather than the status label, decides the path.
        IF v_existing.authority_committed_at IS NOT NULL OR EXISTS (
            SELECT 1
            FROM public.profile_authority_events e
            WHERE e.request_id = v_existing.request_id
        ) THEN
            SELECT EXISTS (
                SELECT 1
                FROM public.profile_authority_events e
                WHERE e.request_id = v_existing.request_id
                  AND e.target_profile_id = v_existing.auth_user_id
                  AND e.source_type = 'network_invitation'
                  AND e.source_id = v_existing.invitation_id
                  AND e.event_type = 'invitation_authority_committed'
            ) INTO v_has_exact_authority_event;

            IF v_existing.authority_committed_at IS NULL
               OR v_existing.auth_user_id IS NULL
               OR v_has_exact_authority_event IS NOT TRUE
               OR v_invitation.used IS NOT TRUE THEN
                RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_STATE_INVALID';
            END IF;
            RETURN jsonb_build_object(
                'provisioning_id', v_existing.id,
                'request_id', v_existing.request_id,
                'status', v_existing.status,
                'auth_user_id', v_existing.auth_user_id
            );
        END IF;

        IF v_existing.status NOT IN ('prepared', 'auth_created_blocked', 'needs_reconciliation') THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_STATE_INVALID';
        END IF;
    END IF;

    IF v_invitation.used IS TRUE OR v_invitation.expires_at IS NULL
       OR v_invitation.expires_at <= v_now THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_INVALID';
    END IF;

    SELECT * INTO v_creator
    FROM public.profiles
    WHERE id = v_invitation.creator_id
    FOR UPDATE;
    IF (
        v_creator.role = 'admin'
        AND v_creator.parent_id IS NULL
        AND v_creator.franchise_id IS NULL
        AND v_invitation.role IN ('agent', 'franchise')
        AND v_invitation.target_franchise_id IS NOT NULL
    ) THEN
        SELECT * INTO v_franchise
        FROM public.franchises f
        WHERE f.id = v_invitation.target_franchise_id
        FOR UPDATE;
        IF v_franchise.id IS NULL OR v_franchise.is_active IS NOT TRUE THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_AUTHORITY_INVALID';
        END IF;
    ELSIF (
        v_creator.role = 'franchise'
        AND v_creator.parent_id IS NOT NULL
        AND v_creator.franchise_id IS NOT NULL
        AND v_invitation.role = 'agent'
        AND v_invitation.target_franchise_id IS NULL
    ) THEN
        SELECT * INTO v_franchise
        FROM public.franchises f
        WHERE f.id = v_creator.franchise_id
        FOR UPDATE;
        SELECT * INTO v_creator_parent
        FROM public.profiles
        WHERE id = v_creator.parent_id
        FOR UPDATE;
        IF v_franchise.id IS NULL OR v_franchise.is_active IS NOT TRUE
           OR v_creator_parent.id IS NULL
           OR v_creator_parent.role IS DISTINCT FROM 'admin'
           OR v_creator_parent.parent_id IS NOT NULL
           OR v_creator_parent.franchise_id IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_AUTHORITY_INVALID';
        END IF;
    ELSE
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVITATION_AUTHORITY_INVALID';
    END IF;

    IF v_existing.id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'provisioning_id', v_existing.id,
            'request_id', v_existing.request_id,
            'status', v_existing.status,
            'auth_user_id', v_existing.auth_user_id
        );
    END IF;

    -- Reaching here proves this is the new-provisioning path. Existing precommit
    -- and postcommit retries have already returned their stored request_id.
    IF EXISTS (
        SELECT 1
        FROM public.profile_authority_events e
        WHERE e.request_id = p_request_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ID_CONFLICT';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.profile_invitation_provisioning WHERE request_id = p_request_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'REQUEST_ID_CONFLICT';
    END IF;

    INSERT INTO public.profile_invitation_provisioning (id, invitation_id, request_id)
    VALUES (v_id, p_invitation_id, p_request_id);

    RETURN jsonb_build_object(
        'provisioning_id', v_id,
        'request_id', p_request_id,
        'status', 'prepared',
        'auth_user_id', NULL
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.record_profile_invitation_auth_user(
    p_provisioning_id uuid,
    p_auth_user_id uuid,
    p_banned_until timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_row public.profile_invitation_provisioning%ROWTYPE;
BEGIN
    IF p_auth_user_id IS NULL OR p_banned_until IS NULL OR p_banned_until <= now() THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTH_USER_NOT_BLOCKED';
    END IF;
    SELECT * INTO v_row
    FROM public.profile_invitation_provisioning
    WHERE id = p_provisioning_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_NOT_FOUND';
    END IF;
    IF v_row.auth_user_id IS NOT NULL
       AND v_row.auth_user_id IS DISTINCT FROM p_auth_user_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTH_USER_CONFLICT';
    END IF;
    IF v_row.status NOT IN ('prepared', 'auth_created_blocked') THEN
        RETURN jsonb_build_object('provisioning_id', v_row.id, 'status', v_row.status);
    END IF;

    BEGIN
        UPDATE public.profile_invitation_provisioning
        SET auth_user_id = p_auth_user_id,
            banned_until = p_banned_until,
            status = 'auth_created_blocked',
            updated_at = now(),
            last_attempt_at = now(),
            attempt_count = attempt_count + 1,
            safe_error_code = NULL
        WHERE id = p_provisioning_id;
    EXCEPTION WHEN unique_violation THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTH_USER_CONFLICT';
    END;
    RETURN jsonb_build_object('provisioning_id', p_provisioning_id, 'status', 'auth_created_blocked');
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_profile_invitation_provisioning(
    p_provisioning_id uuid,
    p_auth_user_id uuid,
    p_observed_banned_until timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_row public.profile_invitation_provisioning%ROWTYPE;
BEGIN
    SELECT * INTO v_row
    FROM public.profile_invitation_provisioning
    WHERE id = p_provisioning_id
    FOR UPDATE;
    IF NOT FOUND OR v_row.auth_user_id IS DISTINCT FROM p_auth_user_id THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_NOT_FOUND';
    END IF;
    IF v_row.status = 'completed' THEN
        RETURN jsonb_build_object('provisioning_id', v_row.id, 'status', 'completed');
    END IF;
    IF v_row.status NOT IN ('authority_committed', 'needs_reconciliation')
       OR v_row.authority_committed_at IS NULL
       OR p_observed_banned_until IS NOT NULL
       OR NOT EXISTS (
           SELECT 1 FROM public.profile_authority_events e
           WHERE e.request_id = v_row.request_id
             AND e.target_profile_id = v_row.auth_user_id
             AND e.event_type = 'invitation_authority_committed'
       ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'AUTH_UNBAN_NOT_VERIFIED';
    END IF;

    UPDATE public.profile_invitation_provisioning
    SET status = 'completed',
        banned_until = NULL,
        completed_at = now(),
        updated_at = now(),
        last_attempt_at = now(),
        attempt_count = attempt_count + 1,
        safe_error_code = NULL
    WHERE id = p_provisioning_id;
    RETURN jsonb_build_object('provisioning_id', p_provisioning_id, 'status', 'completed');
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_profile_invitation_provisioning(
    p_mark_provisioning_id uuid DEFAULT NULL,
    p_safe_error_code text DEFAULT NULL,
    p_limit integer DEFAULT 100
)
RETURNS TABLE (
    provisioning_id uuid,
    invitation_id uuid,
    request_id uuid,
    auth_user_id uuid,
    status text,
    banned_until timestamptz,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
    IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECONCILIATION_LIMIT_INVALID';
    END IF;
    IF p_mark_provisioning_id IS NOT NULL THEN
        IF p_safe_error_code IS NULL OR p_safe_error_code NOT IN (
            'auth_user_conflict', 'auth_lookup_mismatch', 'unban_failed',
            'cleanup_unsafe', 'state_inconsistent', 'retry_exhausted'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SAFE_ERROR_CODE_INVALID';
        END IF;
        IF EXISTS (
            SELECT 1
            FROM public.profile_invitation_provisioning p
            WHERE p.id = p_mark_provisioning_id
              AND p.auth_user_id IS NULL
              AND p_safe_error_code IS DISTINCT FROM 'auth_user_conflict'
              AND p_safe_error_code IS DISTINCT FROM 'auth_lookup_mismatch'
        ) THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECONCILIATION_STATE_INVALID';
        END IF;
        UPDATE public.profile_invitation_provisioning p
        SET status = 'needs_reconciliation',
            safe_error_code = p_safe_error_code,
            updated_at = now(),
            last_attempt_at = now(),
            attempt_count = p.attempt_count + 1
        WHERE p.id = p_mark_provisioning_id AND p.status <> 'completed';
        IF NOT FOUND THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PROVISIONING_NOT_FOUND';
        END IF;
    END IF;

    -- Bounded housekeeping belongs on the worker path, never on an interactive attempt.
    WITH expired_receipts AS (
        SELECT receipt.id
        FROM public.profile_join_rate_limit_receipts receipt
        WHERE receipt.expires_at <= now()
        ORDER BY receipt.expires_at, receipt.id
        LIMIT 1000
        FOR UPDATE SKIP LOCKED
    )
    DELETE FROM public.profile_join_rate_limit_receipts receipt
    USING expired_receipts expired
    WHERE receipt.id = expired.id;

    WITH expired AS (
        SELECT r.id
        FROM public.profile_join_rate_limits r
        WHERE r.expires_at <= now()
        ORDER BY r.expires_at, r.id
        LIMIT 1000
        FOR UPDATE SKIP LOCKED
    )
    DELETE FROM public.profile_join_rate_limits r
    USING expired e
    WHERE r.id = e.id;

    RETURN QUERY
    WITH candidates AS (
        SELECT p.id
        FROM public.profile_invitation_provisioning p
        WHERE p.status <> 'completed'
          AND p.updated_at <= now() - interval '2 minutes'
        ORDER BY p.updated_at, p.id
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED
    ), touched AS (
        UPDATE public.profile_invitation_provisioning p
        SET updated_at = now(),
            last_attempt_at = now(),
            attempt_count = p.attempt_count + 1
        FROM candidates c
        WHERE p.id = c.id
        RETURNING p.*
    )
    SELECT
        t.id,
        t.invitation_id,
        t.request_id,
        t.auth_user_id,
        t.status,
        t.banned_until,
        t.created_at,
        t.updated_at
    FROM touched t
    ORDER BY t.updated_at, t.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        parent_id,
        franchise_id
    ) VALUES (
        NEW.id,
        NEW.email,
        coalesce(nullif(btrim(NEW.raw_user_meta_data->>'full_name'), ''), 'User'),
        NULL,
        NULL,
        NULL
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

ALTER FUNCTION public.handle_new_user() OWNER TO postgres;

-- Auth-owned tables remain untouched; this trigger is the versioned binding to the
-- public bootstrap function and is recreated in place without altering auth columns/data.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

DO $$
DECLARE
    v_binding_count integer;
BEGIN
    SELECT count(*) INTO v_binding_count
        FROM pg_trigger t
        WHERE t.tgrelid = 'auth.users'::regclass
          AND NOT t.tgisinternal
          AND t.tgfoid = 'public.handle_new_user()'::regprocedure
          AND pg_get_triggerdef(t.oid) ILIKE '%AFTER INSERT%';
    IF v_binding_count <> 1 THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'AUTH_PROFILE_TRIGGER_BINDING_INVALID';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION private.prevent_profile_authority_event_mutation() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.profile_authority_state(text, uuid, uuid) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.profile_authority_guard() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.audit_profile_authority_change() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION private.finalize_profile_invitation_authority_core(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.update_own_profile(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_team_member_name(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_profile_authority(uuid, uuid, text, uuid, uuid, bigint, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.consume_profile_join_rate_limit(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_profile_join_rate_limit_receipt(uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.begin_profile_invitation_provisioning(uuid, text, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_profile_invitation_auth_user(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_profile_invitation_authority(uuid, text, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.complete_profile_invitation_provisioning(uuid, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reconcile_profile_invitation_provisioning(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

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

-- Trigger execution does not require browser access. Keep Auth's internal role explicit.
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

COMMENT ON TABLE public.profile_authority_events IS
    'Immutable authority-only evidence for ZIN-SDD-041; contains no identity/fiscal payloads.';
COMMENT ON TABLE public.profile_invitation_provisioning IS
    'Durable cross-system state for blocked Supabase Auth invitation provisioning; no password/email copy.';
COMMENT ON TABLE public.profile_join_rate_limits IS
    '24-hour service-only rate-limit attempts keyed only by application-peppered hashes.';
COMMENT ON TABLE public.profile_join_rate_limit_receipts IS
    'Short-lived PII-free receipts binding one committed rate attempt to one invitation request payload.';
COMMENT ON FUNCTION public.consume_profile_join_rate_limit(text, text) IS
    'Consumes a committed join attempt and issues a short-lived receipt using only application-peppered hashes.';
COMMENT ON FUNCTION public.claim_profile_join_rate_limit_receipt(uuid, uuid, uuid, text) IS
    'Durably binds one receipt to one invitation UUID, request UUID, and application-peppered payload hash.';
COMMENT ON FUNCTION public.begin_profile_invitation_provisioning(uuid, text, uuid, uuid, text) IS
    'Requires an already-claimed exact-match receipt; expected email is compared transiently and never persisted.';

COMMIT;
