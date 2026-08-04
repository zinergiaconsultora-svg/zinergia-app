BEGIN;
SET LOCAL statement_timeout = '45s';
SET LOCAL lock_timeout = '5s';
SET LOCAL client_min_messages = log;

-- ZIN-SDD-041 T6 expansion checkpoint only.
--
-- The runner replaces these three UUID placeholders with dedicated staging
-- profiles. They must already exist (and therefore already have Auth rows), but
-- this script never reads or writes auth.users and never invokes an Auth Admin API:
--   __EXPAND_ADMIN_PROFILE_ID__
--   __EXPAND_FRANCHISE_PROFILE_ID__
--   __EXPAND_TARGET_PROFILE_ID__
--
-- All other fixtures are synthetic, contain no real identity data, and disappear
-- at the unconditional ROLLBACK below.

DO $$
DECLARE
    v_admin_id constant uuid := '__EXPAND_ADMIN_PROFILE_ID__';
    v_franchise_profile_id constant uuid := '__EXPAND_FRANCHISE_PROFILE_ID__';
    v_target_id constant uuid := '__EXPAND_TARGET_PROFILE_ID__';
    v_franchise_id constant uuid := '10000000-0000-4000-8000-000000000001';
    v_inactive_franchise_id constant uuid := '10000000-0000-4000-8000-000000000002';
    v_invitation_id constant uuid := '20000000-0000-4000-8000-000000000001';
    v_cross_invitation_id constant uuid := '20000000-0000-4000-8000-000000000002';
BEGIN
    IF EXISTS (SELECT 1 FROM public.profile_invitation_provisioning)
       OR EXISTS (SELECT 1 FROM public.profile_join_rate_limits)
       OR EXISTS (SELECT 1 FROM public.profile_join_rate_limit_receipts) THEN
        RAISE EXCEPTION 'VERIFY_REQUIRES_EMPTY_PROVISIONING_AND_RATE_TABLES';
    END IF;
    IF v_admin_id = v_franchise_profile_id
       OR v_admin_id = v_target_id
       OR v_franchise_profile_id = v_target_id THEN
        RAISE EXCEPTION 'VERIFY_FIXTURES_NOT_DISTINCT';
    END IF;
    IF (SELECT count(*) FROM public.profiles
        WHERE id IN (v_admin_id, v_franchise_profile_id, v_target_id)) <> 3 THEN
        RAISE EXCEPTION 'VERIFY_PROFILE_FIXTURE_MISSING';
    END IF;

    INSERT INTO public.franchises (id, slug, name, is_active)
    VALUES
        (v_franchise_id, 'expand-verify-franchise', 'Expand Verify Franchise', true),
        (v_inactive_franchise_id, 'expand-verify-inactive', 'Expand Verify Inactive', false);

    -- Establish a fully synthetic canonical matrix through the expansion's
    -- compatibility writer. These setup mutations are rollback-only.
    UPDATE public.profiles
    SET email = 'expand-admin@example.invalid', full_name = 'Expand Verify Admin',
        role = 'admin', parent_id = NULL, franchise_id = NULL
    WHERE id = v_admin_id;
    UPDATE public.profiles
    SET email = 'expand-franchise@example.invalid', full_name = 'Expand Verify Franchise',
        role = 'franchise', parent_id = v_admin_id, franchise_id = v_franchise_id
    WHERE id = v_franchise_profile_id;
    UPDATE public.profiles
    SET email = 'expand-target@example.invalid', full_name = 'Expand Verify Target',
        role = 'agent', parent_id = v_admin_id, franchise_id = v_franchise_id
    WHERE id = v_target_id;

    INSERT INTO public.network_invitations (
        id, creator_id, email, role, code, used, expires_at, target_franchise_id
    ) VALUES
        (
            v_invitation_id, v_admin_id, 'expand-target@example.invalid', 'agent',
            'expand-verify-main', false, now() + interval '30 minutes', v_franchise_id
        ),
        (
            v_cross_invitation_id, v_admin_id, 'expand-cross@example.invalid', 'agent',
            'expand-verify-cross', false, now() + interval '30 minutes', v_franchise_id
        ),
        (
            '20000000-0000-4000-8000-000000000003', v_admin_id,
            'expand-target@example.invalid', 'franchise', 'expand-verify-admin-franchise',
            false, now() + interval '30 minutes', v_franchise_id
        ),
        (
            '20000000-0000-4000-8000-000000000004', v_franchise_profile_id,
            'expand-target@example.invalid', 'agent', 'expand-verify-franchise-agent',
            false, now() + interval '30 minutes', NULL
        ),
        (
            '20000000-0000-4000-8000-000000000005', v_franchise_profile_id,
            'expand-rejected@example.invalid', 'franchise', 'expand-verify-franchise-franchise',
            false, now() + interval '30 minutes', NULL
        ),
        (
            '20000000-0000-4000-8000-000000000006', v_admin_id,
            'expand-inactive@example.invalid', 'agent', 'expand-verify-inactive-target',
            false, now() + interval '30 minutes', v_inactive_franchise_id
        ),
        (
            '20000000-0000-4000-8000-000000000007', v_admin_id,
            'expand-expired@example.invalid', 'agent', 'expand-verify-expired',
            false, now() - interval '1 minute', v_franchise_id
        ),
        (
            '20000000-0000-4000-8000-000000000008', v_admin_id,
            'expand-email-match@example.invalid', 'agent', 'expand-verify-email-mismatch',
            false, now() + interval '30 minutes', v_franchise_id
        ),
        (
            '20000000-0000-4000-8000-000000000009', v_franchise_profile_id,
            'expand-null-creator@example.invalid', 'agent', 'expand-verify-null-creator',
            false, now() + interval '30 minutes', NULL
        ),
        (
            '20000000-0000-4000-8000-000000000010', v_admin_id,
            'expand-missing-target@example.invalid', 'agent', 'expand-verify-missing-target',
            false, now() + interval '30 minutes', NULL
        );
END
$$;

SET LOCAL ROLE service_role;

DO $$
DECLARE
    v_admin_id constant uuid := '__EXPAND_ADMIN_PROFILE_ID__';
    v_franchise_profile_id constant uuid := '__EXPAND_FRANCHISE_PROFILE_ID__';
    v_target_id constant uuid := '__EXPAND_TARGET_PROFILE_ID__';
    v_franchise_id constant uuid := '10000000-0000-4000-8000-000000000001';
    v_inactive_franchise_id constant uuid := '10000000-0000-4000-8000-000000000002';
    v_invitation_id constant uuid := '20000000-0000-4000-8000-000000000001';
    v_cross_invitation_id constant uuid := '20000000-0000-4000-8000-000000000002';
    v_admin_franchise_invitation_id constant uuid := '20000000-0000-4000-8000-000000000003';
    v_franchise_agent_invitation_id constant uuid := '20000000-0000-4000-8000-000000000004';
    v_franchise_franchise_invitation_id constant uuid := '20000000-0000-4000-8000-000000000005';
    v_inactive_invitation_id constant uuid := '20000000-0000-4000-8000-000000000006';
    v_expired_invitation_id constant uuid := '20000000-0000-4000-8000-000000000007';
    v_email_mismatch_invitation_id constant uuid := '20000000-0000-4000-8000-000000000008';
    v_null_creator_invitation_id constant uuid := '20000000-0000-4000-8000-000000000009';
    v_missing_target_invitation_id constant uuid := '20000000-0000-4000-8000-000000000010';
    v_authority_request constant uuid := '30000000-0000-4000-8000-000000000001';
    v_provision_request constant uuid := '30000000-0000-4000-8000-000000000002';
    v_retry_request constant uuid := '30000000-0000-4000-8000-000000000003';
    v_postcommit_request constant uuid := '30000000-0000-4000-8000-000000000004';
    v_reconcile_request constant uuid := '30000000-0000-4000-8000-000000000005';
    v_admin_franchise_request constant uuid := '30000000-0000-4000-8000-000000000006';
    v_franchise_agent_request constant uuid := '30000000-0000-4000-8000-000000000007';
    v_franchise_franchise_request constant uuid := '30000000-0000-4000-8000-000000000008';
    v_inactive_request constant uuid := '30000000-0000-4000-8000-000000000009';
    v_expired_request constant uuid := '30000000-0000-4000-8000-000000000010';
    v_email_mismatch_request constant uuid := '30000000-0000-4000-8000-000000000011';
    v_null_creator_request constant uuid := '30000000-0000-4000-8000-000000000012';
    v_missing_target_request constant uuid := '30000000-0000-4000-8000-000000000013';
    v_payload_hash constant text := repeat('a', 64);
    v_changed_payload_hash constant text := repeat('b', 64);
    v_source_hash constant text := repeat('c', 64);
    v_identity_hash constant text := repeat('d', 64);
    v_receipt_id uuid;
    v_unclaimed_receipt_id uuid;
    v_retry_receipt_id uuid;
    v_cross_receipt_id uuid;
    v_postcommit_receipt_id uuid;
    v_reconcile_receipt_id uuid;
    v_matrix_receipt_id uuid;
    v_provisioning_id uuid;
    v_reconcile_provisioning_id uuid;
    v_matrix_provisioning_id uuid;
    v_reconcile_claimed_id uuid;
    v_result jsonb;
    v_before_version bigint;
    v_after_version bigint;
    v_before_events bigint;
    v_rate_attempts_before bigint;
    v_rate_receipts_before bigint;
    v_reconcile_attempt_before integer;
    v_lease_before timestamptz := '2000-01-01 00:00:00+00';
    v_banned_until timestamptz := now() + interval '1 hour';
    v_denied boolean;
    v_counter integer;
BEGIN
    -- Purpose-specific identity commands do not mutate authority or append events.
    SELECT authority_version INTO v_before_version
    FROM public.profiles WHERE id = v_target_id;
    SELECT count(*) INTO v_before_events
    FROM public.profile_authority_events WHERE target_profile_id = v_target_id;
    PERFORM public.update_own_profile(
        v_admin_id, 'Expand Verify Admin Updated', '000000000', NULL, 'Europe/Madrid'
    );
    PERFORM public.update_team_member_name(
        v_admin_id, v_target_id, 'Expand Verify Target Updated'
    );
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = v_admin_id
          AND p.full_name = 'Expand Verify Admin Updated'
          AND p.phone = '000000000'
          AND p.timezone = 'Europe/Madrid'
    ) OR NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        WHERE p.id = v_target_id
          AND p.full_name = 'Expand Verify Target Updated'
    ) OR (SELECT authority_version FROM public.profiles WHERE id = v_target_id) <> v_before_version
       OR (SELECT count(*) FROM public.profile_authority_events
           WHERE target_profile_id = v_target_id) <> v_before_events THEN
        RAISE EXCEPTION 'IDENTITY_COMMAND_STATE_OR_AUTHORITY_CONTRACT_FAILED';
    END IF;

    -- Canonical authority command: update + version + exactly one event are atomic,
    -- and an identical request retry is idempotent.
    PERFORM public.change_profile_authority(
        v_admin_id, v_target_id, 'agent', v_franchise_profile_id, v_franchise_id,
        v_before_version, 'authority_correction', v_authority_request
    );
    PERFORM public.change_profile_authority(
        v_admin_id, v_target_id, 'agent', v_franchise_profile_id, v_franchise_id,
        v_before_version, 'authority_correction', v_authority_request
    );
    SELECT authority_version INTO v_after_version
    FROM public.profiles WHERE id = v_target_id;
    IF v_after_version <> v_before_version + 1
       OR NOT EXISTS (
           SELECT 1
           FROM public.profiles p
           WHERE p.id = v_target_id
             AND p.role = 'agent'
             AND p.parent_id = v_franchise_profile_id
             AND p.franchise_id = v_franchise_id
       )
       OR (SELECT count(*) FROM public.profile_authority_events
           WHERE request_id = v_authority_request) <> 1
       OR NOT EXISTS (
           SELECT 1
           FROM public.profile_authority_events e
           WHERE e.request_id = v_authority_request
             AND e.actor_id = v_admin_id
             AND e.target_profile_id = v_target_id
             AND e.event_type = 'authority_changed'
             AND e.reason_code = 'authority_correction'
             AND e.before_version = v_before_version
             AND e.after_version = v_after_version
             AND e.before_state = jsonb_build_object(
                 'role', 'agent',
                 'parent_id', v_admin_id,
                 'franchise_id', v_franchise_id
             )
             AND e.after_state = jsonb_build_object(
                 'role', 'agent',
                 'parent_id', v_franchise_profile_id,
                 'franchise_id', v_franchise_id
             )
             AND e.source_type IS NULL
             AND e.source_id IS NULL
       ) THEN
        RAISE EXCEPTION 'AUTHORITY_COMMAND_NOT_ATOMIC_OR_IDEMPOTENT';
    END IF;

    -- Immutable evidence must reject every destructive operation.
    v_denied := false;
    BEGIN
        UPDATE public.profile_authority_events SET reason_code = 'tampered'
        WHERE request_id = v_authority_request;
    EXCEPTION WHEN OTHERS THEN v_denied := true;
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'AUTHORITY_EVENT_UPDATE_ALLOWED'; END IF;
    v_denied := false;
    BEGIN
        DELETE FROM public.profile_authority_events WHERE request_id = v_authority_request;
    EXCEPTION WHEN OTHERS THEN v_denied := true;
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'AUTHORITY_EVENT_DELETE_ALLOWED'; END IF;
    v_denied := false;
    BEGIN
        TRUNCATE public.profile_authority_events;
    EXCEPTION WHEN OTHERS THEN v_denied := true;
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'AUTHORITY_EVENT_TRUNCATE_ALLOWED'; END IF;

    -- One committed rate attempt issues a durable, PII-free receipt. Claim replay
    -- is allowed only for the exact invitation/request/payload tuple.
    SELECT count(*) INTO v_rate_attempts_before
    FROM public.profile_join_rate_limits r
    WHERE (r.scope_type = 'source_invitation' AND r.identifier_hash = v_source_hash)
       OR (r.scope_type = 'invitation_email' AND r.identifier_hash = v_identity_hash);
    v_result := public.consume_profile_join_rate_limit(v_source_hash, v_identity_hash);
    v_receipt_id := (v_result->>'receipt_id')::uuid;
    IF v_result->>'allowed' IS DISTINCT FROM 'true'
       OR v_receipt_id IS NULL
       OR (SELECT count(*)
           FROM public.profile_join_rate_limits r
           WHERE (r.scope_type = 'source_invitation' AND r.identifier_hash = v_source_hash)
              OR (r.scope_type = 'invitation_email' AND r.identifier_hash = v_identity_hash)
       ) <> v_rate_attempts_before + 2
       OR NOT EXISTS (
        SELECT 1 FROM public.profile_join_rate_limit_receipts
        WHERE id = v_receipt_id
          AND source_key_hash = v_source_hash
          AND identity_key_hash = v_identity_hash
    ) THEN
        RAISE EXCEPTION 'RATE_LIMIT_RECEIPT_NOT_DURABLE';
    END IF;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_receipt_id, v_invitation_id, v_provision_request, v_payload_hash
    );
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_receipt_id, v_invitation_id, v_provision_request, v_payload_hash
    );
    v_denied := false;
    BEGIN
        PERFORM public.claim_profile_join_rate_limit_receipt(
            v_receipt_id, v_invitation_id, v_provision_request, v_changed_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'RATE_LIMIT_RECEIPT_CONFLICT';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'CHANGED_PAYLOAD_RECEIPT_REPLAY_ALLOWED'; END IF;

    v_denied := false;
    BEGIN
        PERFORM public.claim_profile_join_rate_limit_receipt(
            v_receipt_id, v_cross_invitation_id, v_provision_request, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'RATE_LIMIT_RECEIPT_CONFLICT';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'CHANGED_INVITATION_RECEIPT_REPLAY_ALLOWED'; END IF;

    v_denied := false;
    BEGIN
        PERFORM public.claim_profile_join_rate_limit_receipt(
            v_receipt_id, v_invitation_id, v_retry_request, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'RATE_LIMIT_RECEIPT_CONFLICT';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'CHANGED_REQUEST_RECEIPT_REPLAY_ALLOWED'; END IF;

    -- A real, unexpired receipt that was emitted but never claimed cannot authorize begin.
    v_result := public.consume_profile_join_rate_limit(repeat('3', 64), repeat('4', 64));
    v_unclaimed_receipt_id := (v_result->>'receipt_id')::uuid;
    v_denied := false;
    BEGIN
        PERFORM public.begin_profile_invitation_provisioning(
            v_invitation_id, 'expand-target@example.invalid', gen_random_uuid(),
            v_unclaimed_receipt_id, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'RATE_LIMIT_RECEIPT_INVALID';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'BEGIN_WITH_UNCLAIMED_RECEIPT_ALLOWED'; END IF;

    v_result := public.begin_profile_invitation_provisioning(
        v_invitation_id, 'expand-target@example.invalid', v_provision_request,
        v_receipt_id, v_payload_hash
    );
    v_provisioning_id := (v_result->>'provisioning_id')::uuid;
    IF v_provisioning_id IS NULL
       OR v_result->>'request_id' IS DISTINCT FROM v_provision_request::text THEN
        RAISE EXCEPTION 'BEGIN_DID_NOT_CREATE_DURABLE_PROVISIONING';
    END IF;

    -- Cross-domain request ids are rejected in both directions.
    v_denied := false;
    BEGIN
        PERFORM public.change_profile_authority(
            v_admin_id, v_target_id, 'agent', v_admin_id, v_franchise_id,
            v_after_version, 'authority_correction', v_provision_request
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'REQUEST_ID_CONFLICT';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'CROSS-DOMAIN_PROVISIONING_TO_EVENT_ALLOWED'; END IF;

    v_result := public.consume_profile_join_rate_limit(repeat('e', 64), repeat('f', 64));
    v_cross_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_cross_receipt_id, v_cross_invitation_id, v_authority_request, v_payload_hash
    );
    v_denied := false;
    BEGIN
        PERFORM public.begin_profile_invitation_provisioning(
            v_cross_invitation_id, 'expand-cross@example.invalid', v_authority_request,
            v_cross_receipt_id, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'REQUEST_ID_CONFLICT';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'CROSS-DOMAIN_EVENT_TO_PROVISIONING_ALLOWED'; END IF;

    -- A new HTTP request/receipt resumes the invitation's stored durable request.
    v_result := public.consume_profile_join_rate_limit(repeat('1', 64), repeat('2', 64));
    v_retry_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_retry_receipt_id, v_invitation_id, v_retry_request, v_payload_hash
    );
    v_result := public.begin_profile_invitation_provisioning(
        v_invitation_id, 'expand-target@example.invalid', v_retry_request,
        v_retry_receipt_id, v_payload_hash
    );
    IF v_result->>'request_id' IS DISTINCT FROM v_provision_request::text
       OR (v_result->>'provisioning_id')::uuid IS DISTINCT FROM v_provisioning_id THEN
        RAISE EXCEPTION 'NEW_REQUEST_RETRY_DID_NOT_RESUME_DURABLE_STATE';
    END IF;

    -- Compatibility mode remains observable and advances the version without an
    -- authority event. It also prepares the existing Auth-backed profile as neutral
    -- for the blocked-user finalization probe without touching auth.users.
    IF pg_get_functiondef('private.profile_authority_guard()'::regprocedure)
       !~* 'RAISE[[:space:]]+LOG[[:space:]]+''profile_authority_legacy_write' THEN
        RAISE EXCEPTION 'COMPATIBILITY_WRITER_NOT_OBSERVABLE';
    END IF;
    SELECT count(*) INTO v_before_events
    FROM public.profile_authority_events WHERE target_profile_id = v_target_id;
    UPDATE public.profiles
    SET role = NULL, parent_id = NULL, franchise_id = NULL
    WHERE id = v_target_id;
    IF (SELECT authority_version FROM public.profiles WHERE id = v_target_id) <> v_after_version + 1
       OR (SELECT count(*) FROM public.profile_authority_events
           WHERE target_profile_id = v_target_id) <> v_before_events THEN
        RAISE EXCEPTION 'COMPATIBILITY_WRITER_VERSION_OR_EVENT_CONTRACT_FAILED';
    END IF;

    -- Database-only invitation finalization uses the existing Auth-backed fixture,
    -- records the observed ban supplied by the trusted server, and atomically commits
    -- profile authority + invitation use + event + provisioning state.
    PERFORM public.record_profile_invitation_auth_user(
        v_provisioning_id, v_target_id, v_banned_until
    );
    PERFORM public.finalize_profile_invitation_authority(
        v_provisioning_id, 'Expand Verify Accepted', v_banned_until
    );
    IF NOT EXISTS (
        SELECT 1
        FROM public.profile_invitation_provisioning p
        JOIN public.profile_authority_events e ON e.request_id = p.request_id
        JOIN public.network_invitations i ON i.id = p.invitation_id
        JOIN public.profiles target ON target.id = p.auth_user_id
        WHERE p.id = v_provisioning_id
          AND p.status = 'authority_committed'
          AND i.used IS TRUE
          AND e.event_type = 'invitation_authority_committed'
          AND e.target_profile_id = v_target_id
          AND e.source_id = v_invitation_id
          AND target.role = 'agent'
          AND target.parent_id = v_admin_id
          AND target.franchise_id = v_franchise_id
    ) THEN
        RAISE EXCEPTION 'INVITATION_FINALIZATION_NOT_ATOMIC';
    END IF;

    -- Postcommit retry: a fresh receipt/request must still resolve to the original
    -- durable provisioning and request even though the invitation is already used.
    v_result := public.consume_profile_join_rate_limit(repeat('5', 64), repeat('6', 64));
    v_postcommit_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_postcommit_receipt_id, v_invitation_id, v_postcommit_request, v_payload_hash
    );
    v_result := public.begin_profile_invitation_provisioning(
        v_invitation_id, 'expand-target@example.invalid', v_postcommit_request,
        v_postcommit_receipt_id, v_payload_hash
    );
    IF (v_result->>'provisioning_id')::uuid IS DISTINCT FROM v_provisioning_id
       OR v_result->>'request_id' IS DISTINCT FROM v_provision_request::text
       OR v_result->>'status' IS DISTINCT FROM 'authority_committed' THEN
        RAISE EXCEPTION 'POSTCOMMIT_RETRY_DID_NOT_RESUME_DURABLE_STATE';
    END IF;

    -- Auth unban is represented only by the trusted NULL observation; this verifier
    -- does not call Auth. Database completion must preserve the event and clear the ban.
    v_result := public.complete_profile_invitation_provisioning(
        v_provisioning_id, v_target_id, NULL::timestamptz
    );
    IF v_result->>'status' IS DISTINCT FROM 'completed'
       OR NOT EXISTS (
           SELECT 1
           FROM public.profile_invitation_provisioning p
           WHERE p.id = v_provisioning_id
             AND p.status = 'completed'
             AND p.banned_until IS NULL
             AND p.completed_at IS NOT NULL
             AND EXISTS (
                 SELECT 1 FROM public.profile_authority_events e
                 WHERE e.request_id = p.request_id
                   AND e.target_profile_id = p.auth_user_id
                   AND e.event_type = 'invitation_authority_committed'
             )
       ) THEN
        RAISE EXCEPTION 'PROVISIONING_COMPLETION_CONTRACT_FAILED';
    END IF;

    -- A second, precommit provisioning is made needs_reconciliation and aged so
    -- LIMIT 1 can claim only this synthetic row. The lease and attempt must advance.
    v_result := public.consume_profile_join_rate_limit(repeat('9', 64), repeat('0', 64));
    v_reconcile_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_reconcile_receipt_id, v_cross_invitation_id, v_reconcile_request, v_payload_hash
    );
    v_result := public.begin_profile_invitation_provisioning(
        v_cross_invitation_id, 'expand-cross@example.invalid', v_reconcile_request,
        v_reconcile_receipt_id, v_payload_hash
    );
    v_reconcile_provisioning_id := (v_result->>'provisioning_id')::uuid;
    UPDATE public.profile_invitation_provisioning
    SET status = 'needs_reconciliation',
        safe_error_code = 'auth_user_conflict',
        updated_at = v_lease_before
    WHERE id = v_reconcile_provisioning_id AND status = 'prepared';
    IF NOT FOUND THEN RAISE EXCEPTION 'RECONCILIATION_FIXTURE_NOT_PREPARED'; END IF;
    SELECT attempt_count INTO v_reconcile_attempt_before
    FROM public.profile_invitation_provisioning
    WHERE id = v_reconcile_provisioning_id;

    SELECT claimed.provisioning_id INTO v_reconcile_claimed_id
    FROM public.reconcile_profile_invitation_provisioning(NULL, NULL, 1) claimed;
    IF v_reconcile_claimed_id IS DISTINCT FROM v_reconcile_provisioning_id
       OR NOT EXISTS (
           SELECT 1
           FROM public.profile_invitation_provisioning p
           WHERE p.id = v_reconcile_provisioning_id
             AND p.status = 'needs_reconciliation'
             AND p.updated_at > v_lease_before
             AND p.last_attempt_at IS NOT NULL
             AND p.attempt_count = v_reconcile_attempt_before + 1
       ) THEN
        RAISE EXCEPTION 'RECONCILIATION_LEASE_OR_ATTEMPT_NOT_ADVANCED';
    END IF;
    v_reconcile_claimed_id := NULL;
    SELECT claimed.provisioning_id INTO v_reconcile_claimed_id
    FROM public.reconcile_profile_invitation_provisioning(NULL, NULL, 1) claimed
    WHERE claimed.provisioning_id = v_reconcile_provisioning_id;
    IF v_reconcile_claimed_id IS NOT NULL THEN
        RAISE EXCEPTION 'RECONCILIATION_LEASE_ALLOWED_IMMEDIATE_RECLAIM';
    END IF;

    -- Invitation authority matrix. Reuse the existing Auth-backed target by deleting
    -- only synthetic provisioning fixtures and resetting authority to neutral. Events
    -- remain immutable and every scenario has independent invitation/request evidence.
    DELETE FROM public.profile_invitation_provisioning
    WHERE id = v_provisioning_id AND status = 'completed';
    IF NOT FOUND THEN RAISE EXCEPTION 'ADMIN_AGENT_FIXTURE_CLEANUP_FAILED'; END IF;
    UPDATE public.profiles
    SET role = NULL, parent_id = NULL, franchise_id = NULL
    WHERE id = v_target_id;

    -- Admin -> Franchise success.
    v_result := public.consume_profile_join_rate_limit(
        lpad('a1', 64, '0'), lpad('a2', 64, '0')
    );
    v_matrix_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_matrix_receipt_id, v_admin_franchise_invitation_id,
        v_admin_franchise_request, v_payload_hash
    );
    v_result := public.begin_profile_invitation_provisioning(
        v_admin_franchise_invitation_id, 'expand-target@example.invalid',
        v_admin_franchise_request, v_matrix_receipt_id, v_payload_hash
    );
    v_matrix_provisioning_id := (v_result->>'provisioning_id')::uuid;
    PERFORM public.record_profile_invitation_auth_user(
        v_matrix_provisioning_id, v_target_id, v_banned_until
    );
    PERFORM public.finalize_profile_invitation_authority(
        v_matrix_provisioning_id, 'Expand Verify Admin Franchise', v_banned_until
    );
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles target
        JOIN public.profile_authority_events e ON e.target_profile_id = target.id
        WHERE target.id = v_target_id
          AND target.role = 'franchise'
          AND target.parent_id = v_admin_id
          AND target.franchise_id = v_franchise_id
          AND e.request_id = v_admin_franchise_request
          AND e.event_type = 'invitation_authority_committed'
          AND e.source_id = v_admin_franchise_invitation_id
          AND e.after_state = jsonb_build_object(
              'role', 'franchise', 'parent_id', v_admin_id, 'franchise_id', v_franchise_id
          )
    ) THEN
        RAISE EXCEPTION 'ADMIN_TO_FRANCHISE_MATRIX_FAILED';
    END IF;

    DELETE FROM public.profile_invitation_provisioning
    WHERE id = v_matrix_provisioning_id AND status = 'authority_committed';
    IF NOT FOUND THEN RAISE EXCEPTION 'ADMIN_FRANCHISE_FIXTURE_CLEANUP_FAILED'; END IF;
    UPDATE public.profiles
    SET role = NULL, parent_id = NULL, franchise_id = NULL
    WHERE id = v_target_id;

    -- Franchise -> Agent begins successfully. Deactivating its franchise after begin
    -- must make finalize fail atomically; reactivation then permits the exact matrix.
    v_result := public.consume_profile_join_rate_limit(
        lpad('b1', 64, '0'), lpad('b2', 64, '0')
    );
    v_matrix_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_matrix_receipt_id, v_franchise_agent_invitation_id,
        v_franchise_agent_request, v_payload_hash
    );
    v_result := public.begin_profile_invitation_provisioning(
        v_franchise_agent_invitation_id, 'expand-target@example.invalid',
        v_franchise_agent_request, v_matrix_receipt_id, v_payload_hash
    );
    v_matrix_provisioning_id := (v_result->>'provisioning_id')::uuid;
    PERFORM public.record_profile_invitation_auth_user(
        v_matrix_provisioning_id, v_target_id, v_banned_until
    );
    UPDATE public.franchises SET is_active = false WHERE id = v_franchise_id;
    v_denied := false;
    BEGIN
        PERFORM public.finalize_profile_invitation_authority(
            v_matrix_provisioning_id, 'Expand Verify Franchise Agent', v_banned_until
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'INVITATION_AUTHORITY_INVALID';
    END;
    IF NOT v_denied OR EXISTS (
        SELECT 1
        FROM public.profile_invitation_provisioning p
        JOIN public.network_invitations i ON i.id = p.invitation_id
        WHERE p.id = v_matrix_provisioning_id
          AND (p.status IS DISTINCT FROM 'auth_created_blocked' OR i.used IS TRUE)
    ) OR EXISTS (
        SELECT 1 FROM public.profile_authority_events
        WHERE request_id = v_franchise_agent_request
    ) OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_target_id
          AND (role IS NOT NULL OR parent_id IS NOT NULL OR franchise_id IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'INACTIVE_FRANCHISE_FINALIZE_WAS_NOT_ATOMICALLY_DENIED';
    END IF;
    UPDATE public.franchises SET is_active = true WHERE id = v_franchise_id;
    PERFORM public.finalize_profile_invitation_authority(
        v_matrix_provisioning_id, 'Expand Verify Franchise Agent', v_banned_until
    );
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles target
        JOIN public.profile_authority_events e ON e.target_profile_id = target.id
        WHERE target.id = v_target_id
          AND target.role = 'agent'
          AND target.parent_id = v_franchise_profile_id
          AND target.franchise_id = v_franchise_id
          AND e.request_id = v_franchise_agent_request
          AND e.event_type = 'invitation_authority_committed'
          AND e.source_id = v_franchise_agent_invitation_id
          AND e.after_state = jsonb_build_object(
              'role', 'agent', 'parent_id', v_franchise_profile_id,
              'franchise_id', v_franchise_id
          )
    ) THEN
        RAISE EXCEPTION 'FRANCHISE_TO_AGENT_MATRIX_FAILED';
    END IF;

    -- Franchise -> Franchise is never a permitted creator/role matrix.
    v_result := public.consume_profile_join_rate_limit(
        lpad('c1', 64, '0'), lpad('c2', 64, '0')
    );
    v_matrix_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_matrix_receipt_id, v_franchise_franchise_invitation_id,
        v_franchise_franchise_request, v_payload_hash
    );
    v_denied := false;
    BEGIN
        PERFORM public.begin_profile_invitation_provisioning(
            v_franchise_franchise_invitation_id, 'expand-rejected@example.invalid',
            v_franchise_franchise_request, v_matrix_receipt_id, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'INVITATION_AUTHORITY_INVALID';
    END;
    IF NOT v_denied OR EXISTS (
        SELECT 1 FROM public.profile_invitation_provisioning
        WHERE invitation_id = v_franchise_franchise_invitation_id
    ) OR EXISTS (
        SELECT 1 FROM public.network_invitations
        WHERE id = v_franchise_franchise_invitation_id AND used IS TRUE
    ) THEN
        RAISE EXCEPTION 'FRANCHISE_TO_FRANCHISE_MATRIX_ALLOWED';
    END IF;

    -- Admin invitation targeting an inactive franchise is rejected during begin.
    v_result := public.consume_profile_join_rate_limit(
        lpad('d1', 64, '0'), lpad('d2', 64, '0')
    );
    v_matrix_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_matrix_receipt_id, v_inactive_invitation_id, v_inactive_request, v_payload_hash
    );
    v_denied := false;
    BEGIN
        PERFORM public.begin_profile_invitation_provisioning(
            v_inactive_invitation_id, 'expand-inactive@example.invalid',
            v_inactive_request, v_matrix_receipt_id, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'INVITATION_AUTHORITY_INVALID';
    END;
    IF NOT v_denied OR EXISTS (
        SELECT 1 FROM public.profile_invitation_provisioning
        WHERE invitation_id = v_inactive_invitation_id
    ) OR EXISTS (
        SELECT 1 FROM public.network_invitations
        WHERE id = v_inactive_invitation_id AND used IS TRUE
    ) THEN
        RAISE EXCEPTION 'INACTIVE_TARGET_FRANCHISE_MATRIX_ALLOWED';
    END IF;

    -- Expired invitations fail closed before provisioning is created.
    v_result := public.consume_profile_join_rate_limit(
        lpad('e1', 64, '0'), lpad('e2', 64, '0')
    );
    v_matrix_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_matrix_receipt_id, v_expired_invitation_id, v_expired_request, v_payload_hash
    );
    v_denied := false;
    BEGIN
        PERFORM public.begin_profile_invitation_provisioning(
            v_expired_invitation_id, 'expand-expired@example.invalid',
            v_expired_request, v_matrix_receipt_id, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'INVITATION_INVALID';
    END;
    IF NOT v_denied OR EXISTS (
        SELECT 1 FROM public.profile_invitation_provisioning
        WHERE invitation_id = v_expired_invitation_id
    ) OR EXISTS (
        SELECT 1 FROM public.network_invitations
        WHERE id = v_expired_invitation_id AND used IS TRUE
    ) THEN
        RAISE EXCEPTION 'EXPIRED_INVITATION_MATRIX_ALLOWED';
    END IF;

    -- The expected email is part of the invitation binding and must match.
    v_result := public.consume_profile_join_rate_limit(
        lpad('e3', 64, '0'), lpad('e4', 64, '0')
    );
    v_matrix_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_matrix_receipt_id, v_email_mismatch_invitation_id,
        v_email_mismatch_request, v_payload_hash
    );
    v_denied := false;
    BEGIN
        PERFORM public.begin_profile_invitation_provisioning(
            v_email_mismatch_invitation_id, 'expand-wrong@example.invalid',
            v_email_mismatch_request, v_matrix_receipt_id, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'INVITATION_INVALID';
    END;
    IF NOT v_denied OR EXISTS (
        SELECT 1 FROM public.profile_invitation_provisioning
        WHERE invitation_id = v_email_mismatch_invitation_id
    ) OR EXISTS (
        SELECT 1 FROM public.network_invitations
        WHERE id = v_email_mismatch_invitation_id AND used IS TRUE
    ) THEN
        RAISE EXCEPTION 'EMAIL_MISMATCH_MATRIX_ALLOWED';
    END IF;

    -- network_invitations.creator_id is a non-null FK, so a missing creator is
    -- not constructible without disabling integrity. A creator whose authority
    -- tuple has been cleared is the reachable fail-closed equivalent.
    v_result := public.consume_profile_join_rate_limit(
        lpad('e5', 64, '0'), lpad('e6', 64, '0')
    );
    v_matrix_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_matrix_receipt_id, v_null_creator_invitation_id,
        v_null_creator_request, v_payload_hash
    );
    UPDATE public.profiles
    SET role = NULL, parent_id = NULL, franchise_id = NULL
    WHERE id = v_franchise_profile_id;
    v_denied := false;
    BEGIN
        PERFORM public.begin_profile_invitation_provisioning(
            v_null_creator_invitation_id, 'expand-null-creator@example.invalid',
            v_null_creator_request, v_matrix_receipt_id, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'INVITATION_AUTHORITY_INVALID';
    END;
    UPDATE public.profiles
    SET role = 'franchise', parent_id = v_admin_id, franchise_id = v_franchise_id
    WHERE id = v_franchise_profile_id;
    IF NOT v_denied OR EXISTS (
        SELECT 1 FROM public.profile_invitation_provisioning
        WHERE invitation_id = v_null_creator_invitation_id
    ) OR EXISTS (
        SELECT 1 FROM public.network_invitations
        WHERE id = v_null_creator_invitation_id AND used IS TRUE
    ) THEN
        RAISE EXCEPTION 'NULL_ROLE_CREATOR_MATRIX_ALLOWED';
    END IF;

    -- Admin invitations cannot derive authority without an explicit franchise.
    v_result := public.consume_profile_join_rate_limit(
        lpad('e7', 64, '0'), lpad('e8', 64, '0')
    );
    v_matrix_receipt_id := (v_result->>'receipt_id')::uuid;
    PERFORM public.claim_profile_join_rate_limit_receipt(
        v_matrix_receipt_id, v_missing_target_invitation_id,
        v_missing_target_request, v_payload_hash
    );
    v_denied := false;
    BEGIN
        PERFORM public.begin_profile_invitation_provisioning(
            v_missing_target_invitation_id, 'expand-missing-target@example.invalid',
            v_missing_target_request, v_matrix_receipt_id, v_payload_hash
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'INVITATION_AUTHORITY_INVALID';
    END;
    IF NOT v_denied OR EXISTS (
        SELECT 1 FROM public.profile_invitation_provisioning
        WHERE invitation_id = v_missing_target_invitation_id
    ) OR EXISTS (
        SELECT 1 FROM public.network_invitations
        WHERE id = v_missing_target_invitation_id AND used IS TRUE
    ) THEN
        RAISE EXCEPTION 'ADMIN_MISSING_TARGET_FRANCHISE_MATRIX_ALLOWED';
    END IF;

    -- Exact rate thresholds: ten source attempts and five identity attempts pass;
    -- the immediately following attempt in each scope must fail with RATE_LIMITED.
    SELECT count(*) INTO v_rate_attempts_before
    FROM public.profile_join_rate_limits r
    WHERE r.scope_type = 'source_invitation'
      AND r.identifier_hash = repeat('7', 64);
    FOR v_counter IN 1..10 LOOP
        PERFORM public.consume_profile_join_rate_limit(
            repeat('7', 64), lpad(to_hex(1000 + v_counter), 64, '0')
        );
    END LOOP;
    IF (SELECT count(*) FROM public.profile_join_rate_limits r
        WHERE r.scope_type = 'source_invitation'
          AND r.identifier_hash = repeat('7', 64)) <> v_rate_attempts_before + 10 THEN
        RAISE EXCEPTION 'SOURCE_RATE_LIMIT_ALLOWED_COUNT_INCORRECT';
    END IF;
    SELECT count(*) INTO v_rate_attempts_before
    FROM public.profile_join_rate_limits r
    WHERE r.scope_type = 'source_invitation'
      AND r.identifier_hash = repeat('7', 64);
    SELECT count(*) INTO v_rate_receipts_before
    FROM public.profile_join_rate_limit_receipts receipt
    WHERE receipt.source_key_hash = repeat('7', 64);
    v_denied := false;
    BEGIN
        PERFORM public.consume_profile_join_rate_limit(
            repeat('7', 64), lpad(to_hex(1100), 64, '0')
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'RATE_LIMITED';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'SOURCE_RATE_LIMIT_THRESHOLD_NOT_ENFORCED'; END IF;
    IF (SELECT count(*) FROM public.profile_join_rate_limits r
        WHERE r.scope_type = 'source_invitation'
          AND r.identifier_hash = repeat('7', 64)) <> v_rate_attempts_before
       OR (SELECT count(*) FROM public.profile_join_rate_limit_receipts receipt
           WHERE receipt.source_key_hash = repeat('7', 64)) <> v_rate_receipts_before THEN
        RAISE EXCEPTION 'SOURCE_RATE_LIMIT_DENIAL_PERSISTED_ATTEMPT_OR_RECEIPT';
    END IF;

    SELECT count(*) INTO v_rate_attempts_before
    FROM public.profile_join_rate_limits r
    WHERE r.scope_type = 'invitation_email'
      AND r.identifier_hash = repeat('8', 64);
    FOR v_counter IN 1..5 LOOP
        PERFORM public.consume_profile_join_rate_limit(
            lpad(to_hex(2000 + v_counter), 64, '0'), repeat('8', 64)
        );
    END LOOP;
    IF (SELECT count(*) FROM public.profile_join_rate_limits r
        WHERE r.scope_type = 'invitation_email'
          AND r.identifier_hash = repeat('8', 64)) <> v_rate_attempts_before + 5 THEN
        RAISE EXCEPTION 'IDENTITY_RATE_LIMIT_ALLOWED_COUNT_INCORRECT';
    END IF;
    SELECT count(*) INTO v_rate_attempts_before
    FROM public.profile_join_rate_limits r
    WHERE r.scope_type = 'invitation_email'
      AND r.identifier_hash = repeat('8', 64);
    SELECT count(*) INTO v_rate_receipts_before
    FROM public.profile_join_rate_limit_receipts receipt
    WHERE receipt.identity_key_hash = repeat('8', 64);
    v_denied := false;
    BEGIN
        PERFORM public.consume_profile_join_rate_limit(
            lpad(to_hex(2100), 64, '0'), repeat('8', 64)
        );
    EXCEPTION WHEN SQLSTATE 'P0001' THEN
        v_denied := SQLERRM = 'RATE_LIMITED';
    END;
    IF NOT v_denied THEN RAISE EXCEPTION 'IDENTITY_RATE_LIMIT_THRESHOLD_NOT_ENFORCED'; END IF;
    IF (SELECT count(*) FROM public.profile_join_rate_limits r
        WHERE r.scope_type = 'invitation_email'
          AND r.identifier_hash = repeat('8', 64)) <> v_rate_attempts_before
       OR (SELECT count(*) FROM public.profile_join_rate_limit_receipts receipt
           WHERE receipt.identity_key_hash = repeat('8', 64)) <> v_rate_receipts_before THEN
        RAISE EXCEPTION 'IDENTITY_RATE_LIMIT_DENIAL_PERSISTED_ATTEMPT_OR_RECEIPT';
    END IF;

    -- Multi-session concurrency is intentionally excluded here: transaction-local
    -- fixtures cannot prove blocking order. T6 records it as a separate harness gate.
END
$$;

RESET ROLE;
ROLLBACK;
SELECT 'ok' AS profile_authority_expand_transactional_verification;
