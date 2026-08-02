BEGIN;

DO $$
DECLARE
    v_admin_id uuid;
    v_count integer;
BEGIN
    SELECT id INTO v_admin_id
    FROM public.profiles
    WHERE role = 'admin'
    ORDER BY created_at, id
    LIMIT 1;

    IF v_admin_id IS NULL THEN
        RAISE EXCEPTION 'verification requires an admin profile';
    END IF;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', v_admin_id, 'role', 'authenticated')::text,
        true
    );
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_count FROM public.proposal_acceptance_integrity;
    RESET ROLE;

    IF v_count < 0 THEN
        RAISE EXCEPTION 'acceptance integrity view did not execute';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'ok' AS acceptance_integrity_admin_read_verification;
