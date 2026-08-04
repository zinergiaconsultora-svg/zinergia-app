-- ZIN-SDD-041 T3. Runner replaces UUID placeholders with dedicated staging fixture ids.
-- Every mutation, including direct Data API role probes, is enclosed here and rolled back.
BEGIN;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '5s';

CREATE FUNCTION pg_temp.assert_profile_write_denied(
    attempted_sql text,
    label text,
    undefined_column_is_expected boolean DEFAULT false
) RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    BEGIN
        EXECUTE attempted_sql;
    EXCEPTION
        WHEN insufficient_privilege THEN
            RETURN;
        WHEN undefined_column THEN
            IF undefined_column_is_expected THEN RETURN; END IF;
            RAISE;
    END;
    RAISE EXCEPTION 'direct profile write unexpectedly executed: %', label;
END
$$;

-- These are the write equivalents of Data API calls, evaluated as the exact
-- database roles/JWT claims used by PostgREST. A successful or silently ignored
-- statement fails the verifier. Any successful mutation is still transaction-bound.
SET LOCAL ROLE anon;
SELECT pg_temp.assert_profile_write_denied(
    format('INSERT INTO public.profiles (id, email, role) VALUES (%L, %L, %L)',
        gen_random_uuid(), 'profile-authority-anon@example.invalid', 'agent'),
    'anon INSERT'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', '__TARGET_ID__', 'role', 'authenticated')::text,
    true
);
SELECT pg_temp.assert_profile_write_denied(
    format('UPDATE public.profiles SET full_name = %L WHERE id = %L',
        'forbidden-benign', '__TARGET_ID__'),
    'Agent own benign UPDATE'
);
SELECT pg_temp.assert_profile_write_denied(
    format('UPDATE public.profiles SET role = %L WHERE id = %L', 'admin', '__TARGET_ID__'),
    'Agent own protected UPDATE'
);
SELECT pg_temp.assert_profile_write_denied(
    format('UPDATE public.profiles SET full_name = %L, role = %L WHERE id = %L',
        'forbidden-mixed', 'admin', '__TARGET_ID__'),
    'Agent own mixed UPDATE'
);
SELECT pg_temp.assert_profile_write_denied(
    format('UPDATE public.profiles SET profile_authority_unknown = true WHERE id = %L', '__TARGET_ID__'),
    'Agent unknown-field UPDATE',
    true
);
SELECT pg_temp.assert_profile_write_denied(
    format('UPDATE public.profiles SET role = %L WHERE id = %L', 'admin', '__SAME_FRANCHISE_ID__'),
    'Agent same-franchise peer UPDATE'
);
SELECT pg_temp.assert_profile_write_denied(
    format('UPDATE public.profiles SET franchise_id = %L WHERE id = %L',
        '__NEXT_FRANCHISE_ID__', '__OTHER_AGENT_ID__'),
    'Agent cross-franchise UPDATE'
);
SELECT pg_temp.assert_profile_write_denied(
    format('INSERT INTO public.profiles (id, email, role) VALUES (%L, %L, %L)',
        gen_random_uuid(), 'profile-authority-insert@example.invalid', 'agent'),
    'authenticated INSERT'
);
SELECT pg_temp.assert_profile_write_denied(
    format('DELETE FROM public.profiles WHERE id = %L', '__TARGET_ID__'),
    'authenticated DELETE'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', '__FRANCHISE_ACTOR_ID__', 'role', 'authenticated')::text,
    true
);
SELECT pg_temp.assert_profile_write_denied(
    format('UPDATE public.profiles SET role = %L WHERE id = %L', 'franchise', '__TARGET_ID__'),
    'Franchise subordinate protected UPDATE'
);
RESET ROLE;

SET LOCAL ROLE authenticated;
SELECT set_config(
    'request.jwt.claims',
    jsonb_build_object('sub', '__ADMIN_ID__', 'role', 'authenticated')::text,
    true
);
SELECT pg_temp.assert_profile_write_denied(
    format('UPDATE public.profiles SET role = %L WHERE id = %L', 'admin', '__TARGET_ID__'),
    'Admin JWT direct UPDATE'
);
RESET ROLE;

SET LOCAL ROLE service_role;

DO $$
DECLARE
    admin_id uuid := '__ADMIN_ID__';
    target_id uuid := '__TARGET_ID__';
    other_actor_id uuid := '__SAME_FRANCHISE_ID__';
    next_parent_id uuid := '__NEXT_PARENT_ID__';
    next_franchise_id uuid := '__NEXT_FRANCHISE_ID__';
    v_request_id uuid := gen_random_uuid();
    v_stale_request_id uuid := gen_random_uuid();
    v_invalid_request_id uuid := gen_random_uuid();
    original_version bigint;
    changed_version bigint;
    mutation_blocked boolean := false;
    event_update_blocked boolean := false;
    event_delete_blocked boolean := false;
    event_truncate_blocked boolean := false;
    non_admin_blocked boolean := false;
    conflicting_retry_blocked boolean := false;
    invalid_reason_blocked boolean := false;
BEGIN
    SELECT authority_version INTO original_version
    FROM public.profiles WHERE id = target_id FOR UPDATE;
    IF original_version IS NULL THEN
        RAISE EXCEPTION 'fixture target missing authority_version';
    END IF;

    PERFORM public.change_profile_authority(
        admin_id, target_id, 'agent', next_parent_id, next_franchise_id,
        original_version, 'authority_correction', v_request_id
    );
    PERFORM public.change_profile_authority(
        admin_id, target_id, 'agent', next_parent_id, next_franchise_id,
        original_version, 'authority_correction', v_request_id
    );

    IF (SELECT count(*) FROM public.profile_authority_events event WHERE event.request_id = v_request_id) <> 1 THEN
        RAISE EXCEPTION 'idempotent retry did not converge to one event';
    END IF;
    SELECT authority_version INTO changed_version FROM public.profiles WHERE id = target_id;

    BEGIN
        PERFORM public.change_profile_authority(
            admin_id, target_id, 'agent', '__CONFLICT_PARENT_ID__'::uuid, next_franchise_id,
            original_version, 'authority_correction', v_request_id
        );
    EXCEPTION WHEN OTHERS THEN conflicting_retry_blocked := true;
    END;
    IF NOT conflicting_retry_blocked THEN RAISE EXCEPTION 'conflicting request-id reuse succeeded'; END IF;

    BEGIN
        PERFORM public.change_profile_authority(
            admin_id, target_id, 'agent', next_parent_id, next_franchise_id,
            changed_version, 'not_a_reason', v_invalid_request_id
        );
    EXCEPTION WHEN OTHERS THEN invalid_reason_blocked := true;
    END;
    IF NOT invalid_reason_blocked
       OR (SELECT authority_version FROM public.profiles WHERE id = target_id) <> changed_version
       OR EXISTS (SELECT 1 FROM public.profile_authority_events event WHERE event.request_id = v_invalid_request_id) THEN
        RAISE EXCEPTION 'invalid reason was not atomic';
    END IF;

    BEGIN
        UPDATE public.profiles SET role = 'admin' WHERE id = target_id;
    EXCEPTION WHEN OTHERS THEN mutation_blocked := true;
    END;
    IF NOT mutation_blocked THEN RAISE EXCEPTION 'direct service-role authority update succeeded'; END IF;

    BEGIN
        PERFORM public.change_profile_authority(
            other_actor_id, target_id, 'agent', next_parent_id, next_franchise_id,
            original_version + 1, 'authority_correction', v_stale_request_id
        );
    EXCEPTION WHEN OTHERS THEN non_admin_blocked := true;
    END;
    IF NOT non_admin_blocked THEN RAISE EXCEPTION 'non-Admin authority command succeeded'; END IF;

    BEGIN
        UPDATE public.profile_authority_events SET reason_code = 'tampered'
        WHERE request_id = v_request_id;
    EXCEPTION WHEN OTHERS THEN event_update_blocked := true;
    END;
    BEGIN
        DELETE FROM public.profile_authority_events WHERE request_id = v_request_id;
    EXCEPTION WHEN OTHERS THEN event_delete_blocked := true;
    END;
    BEGIN
        TRUNCATE public.profile_authority_events;
    EXCEPTION WHEN OTHERS THEN event_truncate_blocked := true;
    END;
    IF NOT event_update_blocked OR NOT event_delete_blocked OR NOT event_truncate_blocked THEN
        RAISE EXCEPTION 'append-only event enforcement is incomplete';
    END IF;
END
$$;

RESET ROLE;
ROLLBACK;
SELECT 'ok' AS profile_authority_transactional_verification;
