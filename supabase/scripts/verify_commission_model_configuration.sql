-- Target: staging only.
-- Purpose: prove atomic dual-plan configuration, optional partner assignment and effective privileges.
-- Safety: all writes are rolled back.

BEGIN;
SET LOCAL ROLE service_role;

DO $$
DECLARE
    actor_id uuid;
    partner_id uuid;
    configured jsonb;
    expected_assignments integer;
BEGIN
    SELECT id
    INTO actor_id
    FROM public.profiles
    WHERE role = 'admin'
    ORDER BY created_at
    LIMIT 1;

    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'verification requires one admin profile';
    END IF;

    SELECT id
    INTO partner_id
    FROM public.profiles
    WHERE id <> actor_id
    ORDER BY created_at
    LIMIT 1;

    expected_assignments := CASE WHEN partner_id IS NULL THEN 0 ELSE 1 END;

    configured := public.configure_commission_model(
        actor_id,
        'Verificación socios directos',
        7500,
        'Verificación red franquiciada',
        4500,
        1500,
        CASE WHEN partner_id IS NULL THEN ARRAY[]::uuid[] ELSE ARRAY[partner_id] END,
        'Verificación transaccional'
    );

    IF (configured->>'assignedCount')::integer <> expected_assignments THEN
        RAISE EXCEPTION 'unexpected assignment count';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.commission_plans
        WHERE id = (configured->>'directPlanId')::uuid
          AND channel = 'partner_direct'
          AND commercial_share_bps = 7500
          AND franchise_share_bps = 0
          AND central_share_bps = 2500
    ) OR NOT EXISTS (
        SELECT 1
        FROM public.commission_plans
        WHERE id = (configured->>'franchisePlanId')::uuid
          AND channel = 'franchise_network'
          AND commercial_share_bps = 4500
          AND franchise_share_bps = 1500
          AND central_share_bps = 4000
    ) THEN
        RAISE EXCEPTION 'configured plans are not balanced';
    END IF;

    IF partner_id IS NOT NULL AND NOT EXISTS (
        SELECT 1
        FROM public.commission_plan_assignments
        WHERE commercial_id = partner_id
          AND plan_id = (configured->>'directPlanId')::uuid
          AND effective_to IS NULL
    ) THEN
        RAISE EXCEPTION 'direct partner was not assigned';
    END IF;

    BEGIN
        PERFORM public.configure_commission_model(
            actor_id,
            'Modelo directo inválido',
            5500,
            'Modelo franquicia inválido',
            6000,
            1000,
            ARRAY[]::uuid[],
            'Debe rechazarse'
        );
        RAISE EXCEPTION 'invalid channel hierarchy was accepted';
    EXCEPTION
        WHEN SQLSTATE '22023' THEN NULL;
    END;

    IF has_function_privilege('anon', 'public.configure_commission_model(uuid,text,integer,text,integer,integer,uuid[],text)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.configure_commission_model(uuid,text,integer,text,integer,integer,uuid[],text)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.configure_commission_model(uuid,text,integer,text,integer,integer,uuid[],text)', 'EXECUTE')
    THEN
        RAISE EXCEPTION 'unexpected configure_commission_model privileges';
    END IF;
END;
$$;

SELECT 'ok' AS commission_model_configuration_verification;
ROLLBACK;
