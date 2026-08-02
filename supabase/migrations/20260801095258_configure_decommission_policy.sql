BEGIN;

CREATE OR REPLACE FUNCTION public.configure_decommission_policy(
    p_actor_id uuid,
    p_marketer_name text,
    p_product_code text,
    p_consolidation_days integer,
    p_clawback_days integer,
    p_bands jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    normalized_marketer text := btrim(coalesce(p_marketer_name, ''));
    normalized_product text := nullif(btrim(coalesce(p_product_code, '')), '');
    policy_code text;
    policy_name text;
    policy_version integer;
    policy_id uuid;
    band jsonb;
    active_day_from integer;
    active_day_to integer;
    reversal_bps integer;
    expected_day_from integer := 0;
    previous_reversal_bps integer := 10001;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = p_actor_id AND role = 'admin'
    ) THEN
        RAISE EXCEPTION 'decommission policy configuration unavailable' USING ERRCODE = '42501';
    END IF;

    IF p_consolidation_days IS NULL
       OR p_clawback_days IS NULL
       OR p_bands IS NULL
       OR length(normalized_marketer) NOT BETWEEN 2 AND 120
       OR (normalized_product IS NOT NULL AND length(normalized_product) > 80)
       OR p_consolidation_days NOT BETWEEN 0 AND 3650
       OR p_clawback_days NOT BETWEEN p_consolidation_days AND 3650
       OR jsonb_typeof(p_bands) <> 'array'
       OR jsonb_array_length(p_bands) NOT BETWEEN 1 AND 12
    THEN
        RAISE EXCEPTION 'invalid decommission policy configuration' USING ERRCODE = '22023';
    END IF;

    FOR band IN SELECT value FROM jsonb_array_elements(p_bands)
    LOOP
        IF jsonb_typeof(band) <> 'object'
           OR coalesce(band->>'activeDayFrom', '') !~ '^[0-9]+$'
           OR coalesce(band->>'activeDayTo', '') !~ '^[0-9]+$'
           OR coalesce(band->>'reversalBps', '') !~ '^[0-9]+$'
        THEN
            RAISE EXCEPTION 'invalid decommission policy band' USING ERRCODE = '22023';
        END IF;

        active_day_from := (band->>'activeDayFrom')::integer;
        active_day_to := (band->>'activeDayTo')::integer;
        reversal_bps := (band->>'reversalBps')::integer;

        IF active_day_from <> expected_day_from
           OR active_day_to < active_day_from
           OR active_day_to > p_clawback_days
           OR reversal_bps NOT BETWEEN 0 AND 10000
           OR reversal_bps > previous_reversal_bps
        THEN
            RAISE EXCEPTION 'decommission policy bands must be continuous and non-increasing'
                USING ERRCODE = '23514';
        END IF;

        expected_day_from := active_day_to + 1;
        previous_reversal_bps := reversal_bps;
    END LOOP;

    IF expected_day_from <> p_clawback_days + 1 THEN
        RAISE EXCEPTION 'decommission policy bands must cover the full clawback window'
            USING ERRCODE = '23514';
    END IF;

    policy_code := lower(normalized_marketer) || ':' || lower(coalesce(normalized_product, '*'));
    policy_name := left(
        normalized_marketer || ' - ' || coalesce(normalized_product, 'General'),
        120
    );

    PERFORM pg_advisory_xact_lock(hashtextextended('decommission-policy:' || policy_code, 0));

    SELECT coalesce(max(version), 0) + 1
    INTO policy_version
    FROM public.commission_decommission_policies
    WHERE code = policy_code;

    INSERT INTO public.commission_decommission_policies (
        code,
        version,
        name,
        marketer_name,
        product_code,
        consolidation_days,
        clawback_days,
        effective_from,
        created_by
    ) VALUES (
        policy_code,
        policy_version,
        policy_name,
        normalized_marketer,
        normalized_product,
        p_consolidation_days,
        p_clawback_days,
        now(),
        p_actor_id
    )
    RETURNING id INTO policy_id;

    INSERT INTO public.commission_decommission_bands (
        policy_id,
        active_day_from,
        active_day_to,
        reversal_bps
    )
    SELECT
        policy_id,
        (entry->>'activeDayFrom')::integer,
        (entry->>'activeDayTo')::integer,
        (entry->>'reversalBps')::integer
    FROM jsonb_array_elements(p_bands) AS source(entry);

    RETURN policy_id;
END;
$$;

REVOKE ALL ON FUNCTION public.configure_decommission_policy(
    uuid, text, text, integer, integer, jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.configure_decommission_policy(
    uuid, text, text, integer, integer, jsonb
) TO service_role;

COMMENT ON FUNCTION public.configure_decommission_policy(
    uuid, text, text, integer, integer, jsonb
) IS 'Atomically creates one immutable versioned marketer/product decommission policy with continuous non-overlapping bands.';

COMMIT;
