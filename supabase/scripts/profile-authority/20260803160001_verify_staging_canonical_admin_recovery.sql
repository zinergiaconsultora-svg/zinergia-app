-- ZIN-SDD-041 read-only companion for the one-off staging Admin recovery.
--
-- Operator: use the same externally reviewed change ticket; write no operator
-- identity, credentials, connection strings or resolved identifiers here.
-- Target: replace __CONFIRM_STAGING_ONLY__ with STAGING_REVIEWED and replace
-- __RECOVERY_TARGET_PROFILE_ID__ only in an uncommitted local copy, matching the
-- recovery artifact exactly.
-- Environment: approved staging only. Production use is not authorized.
-- Rollback semantics: this verifier is READ ONLY and always ends in ROLLBACK.
-- The recovery itself rolls back atomically on any pre-COMMIT error. Once its
-- append-only event commits, rollback means a new reviewed forward correction;
-- never delete the event or restore the known noncanonical legacy tuple.

BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '15s';
SET LOCAL lock_timeout = '5s';
SET LOCAL client_min_messages = warning;

DO $verification$
DECLARE
    v_staging_confirmation constant text := '__CONFIRM_STAGING_ONLY__';
    v_target_id constant uuid := '__RECOVERY_TARGET_PROFILE_ID__';
    v_request_id constant uuid := '41000000-0000-4000-8000-000000000041';
    v_target public.profiles%ROWTYPE;
    v_event public.profile_authority_events%ROWTYPE;
BEGIN
    IF v_staging_confirmation IS DISTINCT FROM 'STAGING_REVIEWED' THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_STAGING_CONFIRMATION_REQUIRED';
    END IF;

    SELECT * INTO v_target
    FROM public.profiles profile
    WHERE profile.id = v_target_id;

    SELECT * INTO v_event
    FROM public.profile_authority_events event
    WHERE event.request_id = v_request_id;

    IF v_target.id IS NULL
       OR v_event.id IS NULL
       OR v_event.actor_id IS DISTINCT FROM v_target_id
       OR v_event.target_profile_id IS DISTINCT FROM v_target_id
       OR v_event.event_type IS DISTINCT FROM 'authority_changed'
       OR v_event.reason_code IS DISTINCT FROM 'security_recovery'
       OR v_event.before_state->'role' IS DISTINCT FROM '"admin"'::jsonb
       OR (
           v_event.before_state->'parent_id' = 'null'::jsonb
           AND v_event.before_state->'franchise_id' = 'null'::jsonb
       )
       OR v_event.after_state IS DISTINCT FROM private.profile_authority_state(
           'admin', NULL::uuid, NULL::uuid
       )
       OR v_event.after_version IS DISTINCT FROM v_event.before_version + 1
       OR v_event.source_type IS NOT NULL
       OR v_event.source_id IS NOT NULL
       OR v_target.role IS DISTINCT FROM 'admin'
       OR v_target.parent_id IS NOT NULL
       OR v_target.franchise_id IS NOT NULL
       OR v_target.authority_version IS DISTINCT FROM v_event.after_version THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_VERIFICATION_FAILED';
    END IF;

    IF (SELECT count(*)
        FROM public.profile_authority_events event
        WHERE event.request_id = v_request_id) <> 1
       OR (SELECT count(*)
           FROM public.profiles profile
           WHERE profile.role = 'admin'
             AND profile.parent_id IS NULL
             AND profile.franchise_id IS NULL) <> 1
       OR EXISTS (
           SELECT 1
           FROM public.profiles profile
           WHERE profile.role = 'admin'
             AND (profile.parent_id IS NOT NULL OR profile.franchise_id IS NOT NULL)
       )
       OR EXISTS (
           SELECT 1
           FROM public.profile_invitation_provisioning provisioning
           WHERE provisioning.request_id = v_request_id
       ) THEN
        RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'RECOVERY_VERIFICATION_FAILED';
    END IF;
END
$verification$;

ROLLBACK;
