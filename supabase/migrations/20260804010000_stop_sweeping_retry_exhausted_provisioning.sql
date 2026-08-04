-- ZIN-SDD-041 follow-up: make `retry_exhausted` an actual terminal state.
--
-- The expansion migration defined `retry_exhausted` in the safe-error-code CHECK but no
-- caller ever emitted it, and the candidate sweep only excluded `completed`. A permanently
-- broken provisioning was therefore reclaimed every five minutes forever, incrementing
-- attempt_count without bound and spending an Auth directory scan on each cycle.
--
-- This migration only narrows the candidate query. Marking behaviour, housekeeping,
-- ordering and the SKIP LOCKED claim are unchanged, so a row already carrying another
-- safe error code keeps being retried exactly as before.

BEGIN;

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
          -- Terminal: an operator must inspect and re-drive these explicitly. Without this
          -- predicate the row is reclaimed on every run and never leaves the sweep.
          AND p.safe_error_code IS DISTINCT FROM 'retry_exhausted'
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

REVOKE ALL ON FUNCTION public.reconcile_profile_invitation_provisioning(uuid, text, integer)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reconcile_profile_invitation_provisioning(uuid, text, integer)
    TO service_role;

COMMENT ON FUNCTION public.reconcile_profile_invitation_provisioning(uuid, text, integer) IS
    'Claims reconciliation candidates with SKIP LOCKED. Rows marked retry_exhausted are terminal and require explicit operator action.';

COMMIT;
