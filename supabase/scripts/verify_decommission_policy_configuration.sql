-- Target: staging only.
-- Purpose: prove atomic policy versioning, band validation and effective privileges.
-- Safety: all writes are rolled back.

BEGIN;
SET LOCAL ROLE service_role;

DO $$
DECLARE
    actor_id uuid;
    first_policy_id uuid;
    second_policy_id uuid;
    first_version integer;
    second_version integer;
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

    first_policy_id := public.configure_decommission_policy(
        actor_id,
        'Verificación comercializadora',
        'Luz 2.0TD',
        30,
        180,
        '[
            {"activeDayFrom": 0, "activeDayTo": 30, "reversalBps": 10000},
            {"activeDayFrom": 31, "activeDayTo": 90, "reversalBps": 5000},
            {"activeDayFrom": 91, "activeDayTo": 180, "reversalBps": 2500}
        ]'::jsonb
    );

    IF NOT EXISTS (
        SELECT 1
        FROM public.commission_decommission_policies
        WHERE id = first_policy_id
          AND marketer_name = 'Verificación comercializadora'
          AND product_code = 'Luz 2.0TD'
          AND consolidation_days = 30
          AND clawback_days = 180
    ) OR (
        SELECT count(*) FROM public.commission_decommission_bands WHERE policy_id = first_policy_id
    ) <> 3 THEN
        RAISE EXCEPTION 'configured policy or bands are incomplete';
    END IF;

    second_policy_id := public.configure_decommission_policy(
        actor_id,
        'Verificación comercializadora',
        'Luz 2.0TD',
        45,
        180,
        '[
            {"activeDayFrom": 0, "activeDayTo": 45, "reversalBps": 10000},
            {"activeDayFrom": 46, "activeDayTo": 180, "reversalBps": 3000}
        ]'::jsonb
    );

    SELECT version INTO first_version
    FROM public.commission_decommission_policies WHERE id = first_policy_id;
    SELECT version INTO second_version
    FROM public.commission_decommission_policies WHERE id = second_policy_id;

    IF second_version <> first_version + 1 THEN
        RAISE EXCEPTION 'policy version was not incremented';
    END IF;

    BEGIN
        PERFORM public.configure_decommission_policy(
            actor_id,
            'Verificación inválida',
            NULL,
            30,
            180,
            '[
                {"activeDayFrom": 0, "activeDayTo": 30, "reversalBps": 5000},
                {"activeDayFrom": 32, "activeDayTo": 180, "reversalBps": 7500}
            ]'::jsonb
        );
        RAISE EXCEPTION 'invalid policy bands were accepted';
    EXCEPTION
        WHEN SQLSTATE '23514' THEN NULL;
    END;

    IF has_function_privilege('anon', 'public.configure_decommission_policy(uuid,text,text,integer,integer,jsonb)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.configure_decommission_policy(uuid,text,text,integer,integer,jsonb)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.configure_decommission_policy(uuid,text,text,integer,integer,jsonb)', 'EXECUTE')
    THEN
        RAISE EXCEPTION 'unexpected configure_decommission_policy privileges';
    END IF;
END;
$$;

SELECT 'ok' AS decommission_policy_configuration_verification;
ROLLBACK;
