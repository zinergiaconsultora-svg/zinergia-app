BEGIN;

CREATE OR REPLACE FUNCTION public.configure_commission_model(
    p_actor_id uuid,
    p_direct_name text,
    p_direct_commercial_share_bps integer,
    p_franchise_name text,
    p_franchise_commercial_share_bps integer,
    p_franchise_share_bps integer,
    p_direct_commercial_ids uuid[] DEFAULT ARRAY[]::uuid[],
    p_reason text DEFAULT 'Configuración inicial del modelo económico'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    effective_at timestamptz := now();
    direct_plan_id uuid;
    franchise_plan_id uuid;
    direct_version integer;
    franchise_version integer;
    direct_central_bps integer := 10000 - p_direct_commercial_share_bps;
    franchise_central_bps integer := 10000 - p_franchise_commercial_share_bps - p_franchise_share_bps;
    selected_commercial_id uuid;
    requested_count integer := cardinality(coalesce(p_direct_commercial_ids, ARRAY[]::uuid[]));
    distinct_count integer;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE id = p_actor_id
          AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'commission model configuration unavailable' USING ERRCODE = '42501';
    END IF;

    IF length(btrim(coalesce(p_direct_name, ''))) < 3
       OR length(btrim(coalesce(p_franchise_name, ''))) < 3
       OR length(btrim(coalesce(p_reason, ''))) < 3
       OR p_direct_commercial_share_bps NOT BETWEEN 1 AND 9999
       OR p_franchise_commercial_share_bps NOT BETWEEN 1 AND 9999
       OR p_franchise_share_bps NOT BETWEEN 0 AND 9999
       OR direct_central_bps NOT BETWEEN 1 AND 9999
       OR franchise_central_bps NOT BETWEEN 1 AND 9999
       OR p_direct_commercial_share_bps <= p_franchise_commercial_share_bps
       OR direct_central_bps >= franchise_central_bps
    THEN
        RAISE EXCEPTION 'invalid commission model configuration' USING ERRCODE = '22023';
    END IF;

    IF requested_count > 5 THEN
        RAISE EXCEPTION 'at most five direct partners can be configured' USING ERRCODE = '22023';
    END IF;

    SELECT count(DISTINCT candidate_id)::integer
    INTO distinct_count
    FROM unnest(coalesce(p_direct_commercial_ids, ARRAY[]::uuid[])) AS candidate(candidate_id);

    IF distinct_count <> requested_count
       OR p_actor_id = ANY(coalesce(p_direct_commercial_ids, ARRAY[]::uuid[]))
       OR EXISTS (
            SELECT 1
            FROM unnest(coalesce(p_direct_commercial_ids, ARRAY[]::uuid[])) AS candidate(candidate_id)
            WHERE candidate_id IS NULL
               OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = candidate_id)
       )
    THEN
        RAISE EXCEPTION 'invalid direct partner selection' USING ERRCODE = '22023';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended('commission-model-configuration', 0));

    SELECT coalesce(max(version), 0) + 1
    INTO direct_version
    FROM public.commission_plans
    WHERE code = 'partner_direct';

    SELECT coalesce(max(version), 0) + 1
    INTO franchise_version
    FROM public.commission_plans
    WHERE code = 'franchise_network';

    INSERT INTO public.commission_plans (
        code,
        version,
        name,
        channel,
        commercial_share_bps,
        franchise_share_bps,
        central_share_bps,
        effective_from,
        created_by
    ) VALUES (
        'partner_direct',
        direct_version,
        btrim(p_direct_name),
        'partner_direct',
        p_direct_commercial_share_bps,
        0,
        direct_central_bps,
        effective_at,
        p_actor_id
    )
    RETURNING id INTO direct_plan_id;

    INSERT INTO public.commission_plans (
        code,
        version,
        name,
        channel,
        commercial_share_bps,
        franchise_share_bps,
        central_share_bps,
        effective_from,
        created_by
    ) VALUES (
        'franchise_network',
        franchise_version,
        btrim(p_franchise_name),
        'franchise_network',
        p_franchise_commercial_share_bps,
        p_franchise_share_bps,
        franchise_central_bps,
        effective_at,
        p_actor_id
    )
    RETURNING id INTO franchise_plan_id;

    FOREACH selected_commercial_id IN ARRAY coalesce(p_direct_commercial_ids, ARRAY[]::uuid[])
    LOOP
        PERFORM pg_advisory_xact_lock(hashtextextended(selected_commercial_id::text, 0));

        UPDATE public.commission_plan_assignments
        SET effective_to = effective_at
        WHERE commercial_id = selected_commercial_id
          AND effective_to IS NULL
          AND effective_from < effective_at;

        INSERT INTO public.commission_plan_assignments (
            selected_commercial_id,
            plan_id,
            effective_from,
            assigned_by,
            reason
        ) VALUES (
            commercial_id,
            direct_plan_id,
            effective_at,
            p_actor_id,
            btrim(p_reason)
        );
    END LOOP;

    RETURN jsonb_build_object(
        'directPlanId', direct_plan_id,
        'franchisePlanId', franchise_plan_id,
        'assignedCount', requested_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.configure_commission_model(
    uuid, text, integer, text, integer, integer, uuid[], text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.configure_commission_model(
    uuid, text, integer, text, integer, integer, uuid[], text
) TO service_role;

COMMENT ON FUNCTION public.configure_commission_model(
    uuid, text, integer, text, integer, integer, uuid[], text
) IS 'Atomically versions both Zinergia commission channels and assigns up to five existing direct-partner profiles.';

COMMIT;
