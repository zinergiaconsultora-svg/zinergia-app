BEGIN;

DO $$
DECLARE
    v_admin_id uuid;
    v_commercial_id uuid;
    v_other_id uuid;
    v_plan_id uuid;
    v_assignment_id uuid;
    v_visible integer;
BEGIN
    SELECT id INTO v_admin_id
    FROM public.profiles
    WHERE role = 'admin'
    ORDER BY created_at, id
    LIMIT 1;

    SELECT id INTO v_commercial_id
    FROM public.profiles
    WHERE id <> v_admin_id
    ORDER BY created_at, id
    LIMIT 1;

    v_other_id := gen_random_uuid();

    IF v_admin_id IS NULL OR v_commercial_id IS NULL THEN
        RAISE EXCEPTION 'RLS verification requires one admin and one distinct commercial profile';
    END IF;

    INSERT INTO public.commission_plans (
        code, version, name, channel,
        commercial_share_bps, franchise_share_bps, central_share_bps,
        effective_from, created_by
    ) VALUES (
        'verification-rls-' || txid_current()::text, 1, 'Verification RLS', 'partner_direct',
        7500, 0, 2500, clock_timestamp(), v_admin_id
    ) RETURNING id INTO v_plan_id;

    INSERT INTO public.commission_plan_assignments (
        commercial_id, plan_id, effective_from, assigned_by, reason
    ) VALUES (
        v_commercial_id, v_plan_id, clock_timestamp(), v_admin_id, 'RLS verification'
    ) RETURNING id INTO v_assignment_id;

    IF has_table_privilege('authenticated', 'public.commission_plan_assignments', 'INSERT')
       OR has_table_privilege('authenticated', 'public.commission_plan_assignments', 'UPDATE')
       OR has_table_privilege('authenticated', 'public.commission_plan_assignments', 'DELETE')
       OR has_table_privilege('authenticated', 'public.commission_events', 'INSERT')
    THEN
        RAISE EXCEPTION 'authenticated role has direct commission mutation privileges';
    END IF;

    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_commercial_id, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_visible
    FROM public.commission_plan_assignments
    WHERE id = v_assignment_id;
    RESET ROLE;
    IF v_visible <> 1 THEN
        RAISE EXCEPTION 'commercial cannot read own plan assignment';
    END IF;

    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_other_id, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_visible
    FROM public.commission_plan_assignments
    WHERE id = v_assignment_id;
    RESET ROLE;
    IF v_visible <> 0 THEN
        RAISE EXCEPTION 'unrelated commercial can read another plan assignment';
    END IF;

    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_admin_id, 'role', 'authenticated')::text, true);
    SET LOCAL ROLE authenticated;
    SELECT count(*) INTO v_visible
    FROM public.commission_plan_assignments
    WHERE id = v_assignment_id;
    RESET ROLE;
    IF v_visible <> 1 THEN
        RAISE EXCEPTION 'admin cannot read commission plan assignments';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'ok' AS commission_lifecycle_rls_verification;
