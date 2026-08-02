-- Transactional staging verification. Synthetic rows are always rolled back.

BEGIN;

DO $$
DECLARE
    test_client_id uuid;
    test_owner_id uuid;
    test_franchise_id uuid;
    test_supply_id uuid := gen_random_uuid();
    test_contract_id uuid := gen_random_uuid();
    unknown_contract_id uuid := gen_random_uuid();
    as_of date := date '2026-07-31';
    confirmed public.contracts%ROWTYPE;
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

    INSERT INTO public.supply_points (id, client_id, supply_type, is_primary)
    VALUES (test_supply_id, test_client_id, 'electricity', false);

    INSERT INTO public.contracts (
        id, client_id, supply_point_id, agent_id, franchise_id,
        marketer_name, tariff_name, status, start_date, end_date, permanence_status
    ) VALUES (
        test_contract_id, test_client_id, test_supply_id, test_owner_id, test_franchise_id,
        'Verification Energy', 'Verification 2.0TD', 'active', as_of - 300, as_of + 60, 'known'
    ), (
        unknown_contract_id, test_client_id, test_supply_id, test_owner_id, test_franchise_id,
        'Verification Energy', 'Unknown permanence', 'active', as_of - 200, NULL, 'unknown'
    );

    PERFORM * FROM public.reconcile_contract_renewals(as_of);
    PERFORM * FROM public.reconcile_contract_renewals(as_of);

    IF (
        SELECT count(*) FROM public.opportunities
        WHERE source_contract_id = test_contract_id AND type = 'renewal'
    ) <> 1 THEN
        RAISE EXCEPTION 'renewal opportunity is not idempotent';
    END IF;

    IF (
        SELECT count(*) FROM public.contract_renewal_reminders
        WHERE contract_id = test_contract_id AND threshold_days = 60
    ) <> 1 THEN
        RAISE EXCEPTION '60-day reminder is not idempotent';
    END IF;

    IF (
        SELECT count(*)
        FROM public.opportunity_stage_history history
        JOIN public.opportunities opportunity ON opportunity.id = history.opportunity_id
        WHERE opportunity.source_contract_id = test_contract_id
          AND history.reason_code = 'renewal_window_opened'
    ) <> 1 THEN
        RAISE EXCEPTION 'renewal history is not idempotent';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.contract_renewal_data_quality
        WHERE contract_id = unknown_contract_id
    ) THEN
        RAISE EXCEPTION 'unknown permanence is missing from data-quality queue';
    END IF;

    confirmed := public.confirm_contract_permanence(
        unknown_contract_id, test_owner_id, 'none', NULL
    );

    IF confirmed.permanence_status <> 'none' OR confirmed.end_date IS NOT NULL THEN
        RAISE EXCEPTION 'explicit no-permanence confirmation failed';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.contract_renewal_data_quality
        WHERE contract_id = unknown_contract_id
    ) THEN
        RAISE EXCEPTION 'confirmed permanence remained in data-quality queue';
    END IF;

    RAISE NOTICE 'CANONICAL_CONTRACT_RENEWALS_VERIFIED';
END;
$$;

ROLLBACK;
