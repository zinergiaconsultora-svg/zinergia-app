-- Canonical OCR -> client -> supply point -> opportunity workflow.
-- Plaintext CUPS/DNI never enter this function; encryption and blind indexes
-- are produced by the application before this service-only call.

CREATE OR REPLACE FUNCTION public.reconcile_crm_ocr_opportunity(
    p_job_id uuid,
    p_client_name text,
    p_cups_ciphertext text,
    p_cups_hash text,
    p_cups_last4 text,
    p_dni_cif_ciphertext text,
    p_dni_cif_hash text,
    p_supply_address text,
    p_current_marketer text,
    p_current_tariff text,
    p_contracted_power jsonb,
    p_average_monthly_bill numeric
)
RETURNS TABLE (
    resolution text,
    client_id uuid,
    supply_point_id uuid,
    opportunity_id uuid,
    opportunity_stage text,
    opportunity_created boolean,
    opportunity_advanced boolean
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    job public.ocr_jobs%ROWTYPE;
    existing_client public.clients%ROWTYPE;
    existing_supply public.supply_points%ROWTYPE;
    opportunity public.opportunities%ROWTYPE;
    candidate_count integer := 0;
    transition_at timestamptz := clock_timestamp();
    created_opportunity boolean := false;
    advanced_opportunity boolean := false;
BEGIN
    IF p_client_name IS NULL
       OR btrim(p_client_name) = ''
       OR length(p_client_name) > 200
       OR p_cups_hash IS NULL
       OR p_cups_hash !~ '^[a-f0-9]{64}$'
       OR p_cups_ciphertext IS NULL
       OR p_cups_ciphertext !~ '^v1\.'
       OR p_cups_last4 IS NULL
       OR p_cups_last4 !~ '^[A-Z0-9]{4}$'
    THEN
        RAISE EXCEPTION 'invalid protected OCR identity'
            USING ERRCODE = '22023';
    END IF;

    IF p_dni_cif_hash IS NOT NULL
       AND (
           p_dni_cif_hash !~ '^[a-f0-9]{64}$'
           OR p_dni_cif_ciphertext IS NULL
           OR p_dni_cif_ciphertext !~ '^v1\.'
       )
    THEN
        RAISE EXCEPTION 'invalid protected OCR fiscal identity'
            USING ERRCODE = '22023';
    END IF;

    IF (
           p_contracted_power IS NOT NULL
           AND jsonb_typeof(p_contracted_power) <> 'object'
       )
       OR p_average_monthly_bill < 0
    THEN
        RAISE EXCEPTION 'invalid OCR portfolio fields'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO job
    FROM public.ocr_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'OCR job unavailable'
            USING ERRCODE = 'P0002';
    END IF;

    IF job.status <> 'completed' THEN
        RAISE EXCEPTION 'OCR job is not completed'
            USING ERRCODE = '22023';
    END IF;

    IF job.agent_id IS NULL THEN
        RAISE EXCEPTION 'OCR job has no accountable uploader'
            USING ERRCODE = '22023';
    END IF;

    IF job.opportunity_id IS NOT NULL THEN
        SELECT *
        INTO opportunity
        FROM public.opportunities
        WHERE id = job.opportunity_id;

        IF opportunity.id IS NULL
           OR opportunity.client_id IS DISTINCT FROM job.client_id
           OR opportunity.supply_point_id IS DISTINCT FROM job.supply_point_id
        THEN
            RAISE EXCEPTION 'OCR job opportunity link is inconsistent'
                USING ERRCODE = '23514';
        END IF;

        RETURN QUERY SELECT
            'linked'::text,
            opportunity.client_id,
            opportunity.supply_point_id,
            opportunity.id,
            opportunity.stage,
            false,
            false;
        RETURN;
    END IF;

    -- Serialize every resolver for the same protected supply identity.
    PERFORM pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended(p_cups_hash, 0)
    );

    SELECT supply.*
    INTO existing_supply
    FROM public.supply_points supply
    WHERE supply.cups_hash = p_cups_hash
    FOR UPDATE;

    IF existing_supply.id IS NOT NULL THEN
        SELECT *
        INTO existing_client
        FROM public.clients
        WHERE id = existing_supply.client_id
        FOR UPDATE;

        IF existing_client.franchise_id IS DISTINCT FROM job.franchise_id THEN
            UPDATE public.ocr_jobs
            SET error_message = 'OCR completado; el suministro requiere revisión manual.'
            WHERE id = job.id;

            RETURN QUERY SELECT
                'manual_review'::text,
                NULL::uuid,
                NULL::uuid,
                NULL::uuid,
                NULL::text,
                false,
                false;
            RETURN;
        END IF;
    ELSE
        SELECT count(*)
        INTO candidate_count
        FROM public.clients candidate
        WHERE candidate.franchise_id IS NOT DISTINCT FROM job.franchise_id
          AND candidate.cups_hash = p_cups_hash;

        IF candidate_count > 1 THEN
            UPDATE public.ocr_jobs
            SET error_message = 'OCR completado; hay varios clientes candidatos.'
            WHERE id = job.id;

            RETURN QUERY SELECT
                'manual_review'::text,
                NULL::uuid,
                NULL::uuid,
                NULL::uuid,
                NULL::text,
                false,
                false;
            RETURN;
        ELSIF candidate_count = 1 THEN
            SELECT *
            INTO existing_client
            FROM public.clients candidate
            WHERE candidate.franchise_id IS NOT DISTINCT FROM job.franchise_id
              AND candidate.cups_hash = p_cups_hash
            FOR UPDATE;
        ELSIF p_dni_cif_hash IS NOT NULL THEN
            SELECT count(*)
            INTO candidate_count
            FROM public.clients candidate
            WHERE candidate.franchise_id IS NOT DISTINCT FROM job.franchise_id
              AND candidate.dni_cif_hash = p_dni_cif_hash;

            IF candidate_count > 1 THEN
                UPDATE public.ocr_jobs
                SET error_message = 'OCR completado; hay varios clientes candidatos.'
                WHERE id = job.id;

                RETURN QUERY SELECT
                    'manual_review'::text,
                    NULL::uuid,
                    NULL::uuid,
                    NULL::uuid,
                    NULL::text,
                    false,
                    false;
                RETURN;
            ELSIF candidate_count = 1 THEN
                SELECT *
                INTO existing_client
                FROM public.clients candidate
                WHERE candidate.franchise_id IS NOT DISTINCT FROM job.franchise_id
                  AND candidate.dni_cif_hash = p_dni_cif_hash
                FOR UPDATE;
            END IF;
        END IF;
    END IF;

    IF existing_client.id IS NULL THEN
        INSERT INTO public.clients (
            franchise_id,
            owner_id,
            name,
            dni_cif_ciphertext,
            dni_cif_hash,
            cups_ciphertext,
            cups_hash,
            address,
            current_supplier,
            tariff_type,
            contracted_power,
            average_monthly_bill,
            segment,
            type,
            status
        )
        VALUES (
            job.franchise_id,
            job.agent_id,
            btrim(p_client_name),
            p_dni_cif_ciphertext,
            p_dni_cif_hash,
            p_cups_ciphertext,
            p_cups_hash,
            NULLIF(btrim(p_supply_address), ''),
            NULLIF(btrim(p_current_marketer), ''),
            NULLIF(btrim(p_current_tariff), ''),
            p_contracted_power,
            p_average_monthly_bill,
            job.client_segment,
            CASE
                WHEN job.client_segment = 'PYME' THEN 'company'
                WHEN job.client_segment = 'RESIDENCIAL' THEN 'residential'
                WHEN p_dni_cif_hash IS NOT NULL THEN 'company'
                ELSE 'residential'
            END,
            'new'
        )
        RETURNING *
        INTO existing_client;
    ELSE
        -- The accountable owner is immutable here: a later uploader must not
        -- take ownership from the existing client.
        UPDATE public.clients
        SET
            cups_ciphertext = p_cups_ciphertext,
            cups_hash = p_cups_hash,
            dni_cif_ciphertext = COALESCE(
                public.clients.dni_cif_ciphertext,
                p_dni_cif_ciphertext
            ),
            dni_cif_hash = COALESCE(
                public.clients.dni_cif_hash,
                p_dni_cif_hash
            ),
            current_supplier = COALESCE(
                NULLIF(btrim(p_current_marketer), ''),
                public.clients.current_supplier
            ),
            tariff_type = COALESCE(
                NULLIF(btrim(p_current_tariff), ''),
                public.clients.tariff_type
            ),
            address = COALESCE(
                NULLIF(btrim(p_supply_address), ''),
                public.clients.address
            ),
            contracted_power = COALESCE(
                p_contracted_power,
                public.clients.contracted_power
            ),
            average_monthly_bill = COALESCE(
                p_average_monthly_bill,
                public.clients.average_monthly_bill
            ),
            segment = COALESCE(
                job.client_segment,
                public.clients.segment
            ),
            status = CASE
                WHEN public.clients.status IN ('new', 'contacted')
                    THEN 'in_process'
                ELSE public.clients.status
            END
        WHERE id = existing_client.id
        RETURNING *
        INTO existing_client;
    END IF;

    IF existing_supply.id IS NULL THEN
        INSERT INTO public.supply_points (
            client_id,
            cups_ciphertext,
            cups_hash,
            cups_last4,
            supply_type,
            address,
            contracted_power,
            current_marketer,
            current_tariff,
            is_primary
        )
        VALUES (
            existing_client.id,
            p_cups_ciphertext,
            p_cups_hash,
            p_cups_last4,
            'electricity',
            NULLIF(btrim(p_supply_address), ''),
            p_contracted_power,
            NULLIF(btrim(p_current_marketer), ''),
            NULLIF(btrim(p_current_tariff), ''),
            NOT EXISTS (
                SELECT 1
                FROM public.supply_points sibling
                WHERE sibling.client_id = existing_client.id
            )
        )
        RETURNING *
        INTO existing_supply;
    ELSE
        UPDATE public.supply_points
        SET
            cups_ciphertext = p_cups_ciphertext,
            cups_last4 = p_cups_last4,
            address = COALESCE(
                NULLIF(btrim(p_supply_address), ''),
                public.supply_points.address
            ),
            contracted_power = COALESCE(
                p_contracted_power,
                public.supply_points.contracted_power
            ),
            current_marketer = COALESCE(
                NULLIF(btrim(p_current_marketer), ''),
                public.supply_points.current_marketer
            ),
            current_tariff = COALESCE(
                NULLIF(btrim(p_current_tariff), ''),
                public.supply_points.current_tariff
            )
        WHERE id = existing_supply.id
        RETURNING *
        INTO existing_supply;
    END IF;

    SELECT candidate.*
    INTO opportunity
    FROM public.opportunities candidate
    WHERE candidate.supply_point_id = existing_supply.id
      AND candidate.type = 'switch'
      AND candidate.closed_at IS NULL
    FOR UPDATE;

    IF opportunity.id IS NULL THEN
        INSERT INTO public.opportunities (
            client_id,
            supply_point_id,
            owner_id,
            franchise_id,
            type,
            stage,
            source,
            stage_entered_at,
            next_action_type,
            next_action_title,
            next_action_due_at
        )
        VALUES (
            existing_client.id,
            existing_supply.id,
            existing_client.owner_id,
            existing_client.franchise_id,
            'switch',
            'invoice_received',
            'invoice_ocr',
            transition_at,
            'wait_for_ocr',
            'Ver estado del OCR',
            transition_at
        )
        RETURNING *
        INTO opportunity;

        created_opportunity := true;

        INSERT INTO public.opportunity_stage_history (
            opportunity_id,
            from_stage,
            to_stage,
            actor_id,
            reason_code,
            safe_metadata,
            created_at
        )
        VALUES (
            opportunity.id,
            NULL,
            'invoice_received',
            job.agent_id,
            'invoice_uploaded',
            '{"source":"ocr_workflow"}'::jsonb,
            transition_at
        );
    END IF;

    IF opportunity.client_id IS DISTINCT FROM existing_client.id
       OR opportunity.owner_id IS DISTINCT FROM existing_client.owner_id
       OR opportunity.franchise_id IS DISTINCT FROM existing_client.franchise_id
    THEN
        RAISE EXCEPTION 'open opportunity portfolio is inconsistent'
            USING ERRCODE = '23514';
    END IF;

    IF opportunity.stage = 'invoice_received' THEN
        UPDATE public.opportunities
        SET
            stage = 'data_review',
            stage_entered_at = transition_at,
            next_action_type = 'review_invoice',
            next_action_title = 'Revisar factura',
            next_action_due_at = transition_at + interval '1 day'
        WHERE id = opportunity.id
        RETURNING *
        INTO opportunity;

        advanced_opportunity := true;

        INSERT INTO public.opportunity_stage_history (
            opportunity_id,
            from_stage,
            to_stage,
            actor_id,
            reason_code,
            safe_metadata,
            created_at
        )
        VALUES (
            opportunity.id,
            'invoice_received',
            'data_review',
            job.agent_id,
            'ocr_completed',
            '{"source":"ocr_workflow"}'::jsonb,
            transition_at
        );
    END IF;

    UPDATE public.ocr_jobs
    SET
        client_id = existing_client.id,
        supply_point_id = existing_supply.id,
        opportunity_id = opportunity.id,
        error_message = NULL
    WHERE id = job.id;

    RETURN QUERY SELECT
        'linked'::text,
        existing_client.id,
        existing_supply.id,
        opportunity.id,
        opportunity.stage,
        created_opportunity,
        advanced_opportunity;
END;
$$;

REVOKE ALL ON FUNCTION public.reconcile_crm_ocr_opportunity(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    numeric
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.reconcile_crm_ocr_opportunity(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    numeric
) TO service_role;

COMMENT ON FUNCTION public.reconcile_crm_ocr_opportunity(
    uuid,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    text,
    jsonb,
    numeric
) IS 'Atomically resolves protected OCR identity, preserves portfolio ownership and links a completed invoice to one compatible open opportunity.';

CREATE OR REPLACE FUNCTION public.confirm_crm_ocr_data(
    p_job_id uuid,
    p_actor_id uuid,
    p_corrected_data jsonb
)
RETURNS public.opportunities
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    job public.ocr_jobs%ROWTYPE;
    opportunity public.opportunities%ROWTYPE;
    actor_role text;
    actor_franchise_id uuid;
    transitioned_opportunity public.opportunities%ROWTYPE;
BEGIN
    IF p_corrected_data IS NULL
       OR jsonb_typeof(p_corrected_data) <> 'object'
       OR octet_length(p_corrected_data::text) > 262144
    THEN
        RAISE EXCEPTION 'invalid corrected OCR data'
            USING ERRCODE = '22023';
    END IF;

    SELECT *
    INTO job
    FROM public.ocr_jobs
    WHERE id = p_job_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'OCR job unavailable'
            USING ERRCODE = 'P0002';
    END IF;

    IF job.status <> 'completed'
       OR job.opportunity_id IS NULL
       OR job.client_id IS NULL
       OR job.supply_point_id IS NULL
    THEN
        RAISE EXCEPTION 'OCR job is not ready for confirmation'
            USING ERRCODE = '22023';
    END IF;

    SELECT role, franchise_id
    INTO actor_role, actor_franchise_id
    FROM public.profiles
    WHERE id = p_actor_id;

    SELECT *
    INTO opportunity
    FROM public.opportunities
    WHERE id = job.opportunity_id
    FOR UPDATE;

    IF actor_role IS NULL
       OR opportunity.id IS NULL
       OR opportunity.client_id IS DISTINCT FROM job.client_id
       OR opportunity.supply_point_id IS DISTINCT FROM job.supply_point_id
       OR NOT (
           actor_role = 'admin'
           OR opportunity.owner_id = p_actor_id
           OR (
               actor_role = 'franchise'
               AND actor_franchise_id IS NOT DISTINCT FROM opportunity.franchise_id
           )
       )
    THEN
        RAISE EXCEPTION 'OCR confirmation is outside the portfolio'
            USING ERRCODE = '42501';
    END IF;

    IF job.confirmed_at IS NOT NULL THEN
        RETURN opportunity;
    END IF;

    IF opportunity.stage <> 'data_review' THEN
        RAISE EXCEPTION 'opportunity is not awaiting OCR confirmation'
            USING ERRCODE = '40001';
    END IF;

    SELECT *
    INTO transitioned_opportunity
    FROM public.transition_crm_opportunity(
        opportunity.id,
        'data_review',
        'proposal_preparation',
        p_actor_id,
        'ocr_data_confirmed',
        '{"source":"ocr_confirmation"}'::jsonb,
        clock_timestamp() + interval '1 day',
        NULL
    );

    UPDATE public.ocr_jobs
    SET
        extracted_data = p_corrected_data,
        confirmed_at = clock_timestamp(),
        confirmed_by = p_actor_id,
        reviewed_at = COALESCE(reviewed_at, clock_timestamp()),
        reviewed_by = COALESCE(reviewed_by, p_actor_id),
        error_message = NULL
    WHERE id = job.id;

    RETURN transitioned_opportunity;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_crm_ocr_data(
    uuid,
    uuid,
    jsonb
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.confirm_crm_ocr_data(
    uuid,
    uuid,
    jsonb
) TO service_role;

COMMENT ON FUNCTION public.confirm_crm_ocr_data(
    uuid,
    uuid,
    jsonb
) IS 'Atomically persists reviewed OCR data and advances its linked opportunity after portfolio authorization.';
