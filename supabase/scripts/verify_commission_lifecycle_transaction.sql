BEGIN;

DO $$
DECLARE
    v_admin_id uuid;
    v_commercial_id uuid;
    v_direct_plan_id uuid;
    v_assignment_id uuid;
    self_assignment_denied boolean := false;
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

    IF v_admin_id IS NULL OR v_commercial_id IS NULL THEN
        RAISE EXCEPTION 'verification requires one admin and one distinct commercial profile';
    END IF;

    INSERT INTO public.commission_plans (
        code, version, name, channel,
        commercial_share_bps, franchise_share_bps, central_share_bps,
        effective_from, created_by
    ) VALUES (
        'verification-direct-' || txid_current()::text, 1, 'Verification direct', 'partner_direct',
        7500, 0, 2500, clock_timestamp(), v_admin_id
    ) RETURNING id INTO v_direct_plan_id;

    v_assignment_id := public.assign_commission_plan(
        v_commercial_id, v_direct_plan_id, v_admin_id, 'Transactional verification', clock_timestamp()
    );

    IF v_assignment_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM public.commission_plan_assignments assignment
        WHERE assignment.id = v_assignment_id
          AND assignment.commercial_id = v_commercial_id
          AND assignment.plan_id = v_direct_plan_id
    ) THEN
        RAISE EXCEPTION 'commission assignment was not persisted';
    END IF;

    BEGIN
        PERFORM public.assign_commission_plan(
            v_admin_id, v_direct_plan_id, v_admin_id, 'Self assignment must fail', clock_timestamp()
        );
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN
        self_assignment_denied := true;
    END;

    IF NOT self_assignment_denied THEN
        RAISE EXCEPTION 'self assignment was not denied';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'ok' AS commission_lifecycle_transaction_verification;
