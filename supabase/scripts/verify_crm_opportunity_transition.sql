-- Transactional integration verification for transition_crm_opportunity.
-- Target: staging. Creates synthetic, PII-free rows and always rolls back.

BEGIN;

DO $$
DECLARE
    test_client_id uuid;
    test_owner_id uuid;
    test_franchise_id uuid;
    test_supply_point_id uuid := gen_random_uuid();
    test_opportunity_id uuid := gen_random_uuid();
    result public.opportunities%ROWTYPE;
BEGIN
    SELECT client.id, client.owner_id, client.franchise_id
    INTO test_client_id, test_owner_id, test_franchise_id
    FROM public.clients client
    JOIN public.profiles owner ON owner.id = client.owner_id
    ORDER BY client.created_at
    LIMIT 1;

    IF test_client_id IS NULL OR test_owner_id IS NULL THEN
        RAISE EXCEPTION 'staging lacks a client with a valid owner';
    END IF;

    INSERT INTO public.supply_points (
        id,
        client_id,
        supply_type,
        is_primary
    )
    VALUES (
        test_supply_point_id,
        test_client_id,
        'electricity',
        false
    );

    INSERT INTO public.opportunities (
        id,
        client_id,
        supply_point_id,
        owner_id,
        franchise_id,
        type,
        stage,
        source,
        next_action_type,
        next_action_title
    )
    VALUES (
        test_opportunity_id,
        test_client_id,
        test_supply_point_id,
        test_owner_id,
        test_franchise_id,
        'switch',
        'invoice_received',
        'transactional_verification',
        'wait_for_ocr',
        'Ver estado del OCR'
    );

    result := public.transition_crm_opportunity(
        test_opportunity_id,
        'invoice_received',
        'data_review',
        test_owner_id,
        'ocr_completed',
        '{"source":"transactional_verification"}'::jsonb,
        NULL,
        NULL
    );

    IF result.stage <> 'data_review'
       OR result.next_action_type <> 'review_invoice'
    THEN
        RAISE EXCEPTION 'valid transition did not persist expected state';
    END IF;

    BEGIN
        PERFORM public.transition_crm_opportunity(
            test_opportunity_id,
            'invoice_received',
            'data_review',
            test_owner_id,
            'ocr_completed',
            '{}'::jsonb,
            NULL,
            NULL
        );
        RAISE EXCEPTION 'stale expected stage was accepted';
    EXCEPTION
        WHEN serialization_failure THEN NULL;
    END;

    BEGIN
        PERFORM public.transition_crm_opportunity(
            test_opportunity_id,
            'data_review',
            'proposal_preparation',
            test_owner_id,
            'ocr_confirmed',
            '{"email":"prohibited"}'::jsonb,
            NULL,
            NULL
        );
        RAISE EXCEPTION 'prohibited metadata was accepted';
    EXCEPTION
        WHEN invalid_parameter_value THEN NULL;
    END;

    result := public.transition_crm_opportunity(
        test_opportunity_id,
        'data_review',
        'proposal_preparation',
        test_owner_id,
        'ocr_confirmed',
        '{"source":"transactional_verification"}'::jsonb,
        NULL,
        NULL
    );

    BEGIN
        UPDATE public.opportunity_stage_history
        SET reason_code = 'tampered'
        WHERE opportunity_id = test_opportunity_id;
        RAISE EXCEPTION 'append-only history accepted an update';
    EXCEPTION
        WHEN SQLSTATE '55000' THEN NULL;
    END;

    IF (
        SELECT count(*)
        FROM public.opportunity_stage_history
        WHERE opportunity_id = test_opportunity_id
    ) <> 2
    THEN
        RAISE EXCEPTION 'unexpected transition history count';
    END IF;

    RAISE NOTICE 'CRM_OPPORTUNITY_TRANSITION_VERIFIED';
END;
$$;

SELECT
    count(*) FILTER (
        WHERE source = 'transactional_verification'
          AND stage = 'proposal_preparation'
    ) AS verified_opportunities,
    (
        SELECT count(*)
        FROM public.opportunity_stage_history history
        JOIN public.opportunities opportunity
            ON opportunity.id = history.opportunity_id
        WHERE opportunity.source = 'transactional_verification'
    ) AS verified_history_events
FROM public.opportunities;

ROLLBACK;
