-- ZIN-SDD-041 one-off staging data recovery. This is not a migration.
--
-- Operator: record the reviewed operator/change ticket outside this file. Do not
-- add a name, email, token, connection string or resolved UUID to this artifact.
-- Target: replace __CONFIRM_STAGING_ONLY__ with STAGING_REVIEWED and replace
-- __RECOVERY_TARGET_PROFILE_ID__ in an uncommitted local copy with the reviewed
-- staging profile UUID. Never commit the resolved copy.
-- Environment: approved staging only. Production use is not authorized.
-- Preconditions: expansion migration applied; exactly zero canonical Admins;
-- target is the sole legacy Admin candidate (`role = admin` with a noncanonical
-- parent/franchise tuple).
-- Rollback: every refusal/error aborts this transaction before COMMIT. After a
-- successful COMMIT, never delete the append-only event or restore the unsafe
-- legacy tuple; use a separately reviewed forward authority correction.
-- Verification: run 20260803160001_verify_staging_canonical_admin_recovery.sql
-- immediately afterward, from the same reviewed staging connection workflow.

BEGIN;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';
SET LOCAL client_min_messages = warning;

DO $recovery$
DECLARE
    v_staging_confirmation constant text := '__CONFIRM_STAGING_ONLY__';
    v_target_id constant uuid := '__RECOVERY_TARGET_PROFILE_ID__';
    -- Stable per artifact: binds retries to this exact recovery operation.
    v_request_id constant uuid := '41000000-0000-4000-8000-000000000041';
    v_event_id uuid := gen_random_uuid();
    v_target public.profiles%ROWTYPE;
    v_existing public.profile_authority_events%ROWTYPE;
    v_context jsonb;
    v_canonical_admin_count bigint;
    v_legacy_candidate_count bigint;
    v_updated_count bigint;
BEGIN
    IF v_staging_confirmation IS DISTINCT FROM 'STAGING_REVIEWED' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_STAGING_CONFIRMATION_REQUIRED';
    END IF;

    -- Serialize with every canonical authority/provisioning decision before
    -- acquiring profile row locks.
    PERFORM pg_advisory_xact_lock(hashtextextended('profile-authority-canonical', 0));

    IF EXISTS (
        SELECT 1
        FROM public.profile_invitation_provisioning provisioning
        WHERE provisioning.request_id = v_request_id
    ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_REQUEST_CONFLICT';
    END IF;

    SELECT * INTO v_existing
    FROM public.profile_authority_events event
    WHERE event.request_id = v_request_id;

    -- Exact replay is a no-op. Any semantic reuse of the request is rejected.
    IF FOUND THEN
        SELECT * INTO v_target
        FROM public.profiles profile
        WHERE profile.id = v_target_id
        FOR UPDATE;

        IF v_target.id IS NULL
           OR v_existing.actor_id IS DISTINCT FROM v_target_id
           OR v_existing.target_profile_id IS DISTINCT FROM v_target_id
           OR v_existing.event_type IS DISTINCT FROM 'authority_changed'
           OR v_existing.reason_code IS DISTINCT FROM 'security_recovery'
           OR v_existing.after_state IS DISTINCT FROM private.profile_authority_state(
               'admin', NULL::uuid, NULL::uuid
           )
           OR v_existing.after_version IS DISTINCT FROM v_existing.before_version + 1
           OR v_existing.source_type IS NOT NULL
           OR v_existing.source_id IS NOT NULL
           OR v_target.role IS DISTINCT FROM 'admin'
           OR v_target.parent_id IS NOT NULL
           OR v_target.franchise_id IS NOT NULL
           OR v_target.authority_version IS DISTINCT FROM v_existing.after_version THEN
            RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_REQUEST_CONFLICT';
        END IF;
        RETURN;
    END IF;

    -- Lock every current Admin-shaped row plus the explicit target. Canonical
    -- writers already hold the global advisory lock, so the following counts
    -- are stable relative to supported authority operations.
    PERFORM 1
    FROM public.profiles profile
    WHERE profile.role = 'admin' OR profile.id = v_target_id
    ORDER BY profile.id
    FOR UPDATE;

    SELECT * INTO v_target
    FROM public.profiles profile
    WHERE profile.id = v_target_id;

    SELECT count(*) INTO v_canonical_admin_count
    FROM public.profiles profile
    WHERE profile.role = 'admin'
      AND profile.parent_id IS NULL
      AND profile.franchise_id IS NULL;

    SELECT count(*) INTO v_legacy_candidate_count
    FROM public.profiles profile
    WHERE profile.role = 'admin'
      AND (profile.parent_id IS NOT NULL OR profile.franchise_id IS NOT NULL);

    IF v_canonical_admin_count <> 0 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_CANONICAL_ADMIN_PRESENT';
    END IF;
    IF v_legacy_candidate_count <> 1
       OR v_target.id IS NULL
       OR v_target.role IS DISTINCT FROM 'admin'
       OR (v_target.parent_id IS NULL AND v_target.franchise_id IS NULL) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_CANDIDATE_INVALID';
    END IF;

    v_context := jsonb_build_object(
        'event_id', v_event_id,
        'actor_id', v_target_id,
        'target_profile_id', v_target_id,
        'event_type', 'authority_changed',
        'reason_code', 'security_recovery',
        'request_id', v_request_id,
        'before_version', v_target.authority_version,
        'after_version', v_target.authority_version + 1,
        'before_state', private.profile_authority_state(
            v_target.role, v_target.parent_id, v_target.franchise_id
        ),
        'after_state', private.profile_authority_state('admin', NULL::uuid, NULL::uuid),
        'source_type', NULL,
        'source_id', NULL
    );

    PERFORM set_config('app.profile_authority_context', v_context::text, true);
    UPDATE public.profiles AS profile
    SET role = 'admin',
        parent_id = NULL,
        franchise_id = NULL,
        authority_version = profile.authority_version + 1
    WHERE profile.id = v_target_id
      AND profile.authority_version = v_target.authority_version
      AND profile.role = 'admin'
      AND (profile.parent_id IS NOT NULL OR profile.franchise_id IS NOT NULL);
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    PERFORM set_config('app.profile_authority_context', '', true);

    IF v_updated_count <> 1 THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_TARGET_CHANGED';
    END IF;

    IF (SELECT count(*)
        FROM public.profile_authority_events event
        WHERE event.request_id = v_request_id
          AND event.id = v_event_id
          AND event.actor_id = v_target_id
          AND event.target_profile_id = v_target_id
          AND event.event_type = 'authority_changed'
          AND event.reason_code = 'security_recovery'
          AND event.before_state = private.profile_authority_state(
              v_target.role, v_target.parent_id, v_target.franchise_id
          )
          AND event.after_state = private.profile_authority_state(
              'admin', NULL::uuid, NULL::uuid
          )
          AND event.before_version = v_target.authority_version
          AND event.after_version = v_target.authority_version + 1
          AND event.source_type IS NULL
          AND event.source_id IS NULL) <> 1
       OR (SELECT count(*)
           FROM public.profiles profile
           WHERE profile.role = 'admin'
             AND profile.parent_id IS NULL
             AND profile.franchise_id IS NULL) <> 1
       OR NOT EXISTS (
           SELECT 1
           FROM public.profiles profile
           WHERE profile.id = v_target_id
             AND profile.role = 'admin'
             AND profile.parent_id IS NULL
             AND profile.franchise_id IS NULL
             AND profile.authority_version = v_target.authority_version + 1
       ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_POSTCONDITION_FAILED';
    END IF;
EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.profile_authority_context', '', true);
    RAISE;
END
$recovery$;

COMMIT;
