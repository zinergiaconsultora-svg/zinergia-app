-- Target: staging first, then production after promotion.
-- Operator/date: Codex, 2026-08-02.
-- Rollback: the transactional fixture always ends with ROLLBACK.

BEGIN;

DO $$
DECLARE
    actor_id uuid;
    client_id uuid;
    contract_id uuid;
    commission_id uuid;
    adjustment_id uuid;
    repeated_adjustment_id uuid;
    plan_result jsonb;
    current_direct public.commission_plans%ROWTYPE;
    current_franchise public.commission_plans%ROWTYPE;
    direct_commercial_bps integer;
    adjustment public.commission_adjustments%ROWTYPE;
    commission public.network_commissions%ROWTYPE;
BEGIN
    SELECT id INTO actor_id
    FROM public.profiles
    WHERE role = 'admin'
    ORDER BY created_at, id
    LIMIT 1;

    IF actor_id IS NULL THEN
        RAISE EXCEPTION 'verification requires one admin profile';
    END IF;

    IF has_function_privilege('anon', 'public.version_commission_plan(uuid,text,text,integer,integer)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.version_commission_plan(uuid,text,text,integer,integer)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.version_commission_plan(uuid,text,text,integer,integer)', 'EXECUTE')
       OR has_function_privilege('anon', 'public.propose_permanence_decommission(uuid,uuid,date,text,uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.propose_permanence_decommission(uuid,uuid,date,text,uuid)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.propose_permanence_decommission(uuid,uuid,date,text,uuid)', 'EXECUTE')
    THEN
        RAISE EXCEPTION 'service-only function privileges are incorrect';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'commission_plans_one_active_code_idx'
    ) OR NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'commission_adjustments_one_open_permanence_idx'
    ) THEN
        RAISE EXCEPTION 'required uniqueness indexes are missing';
    END IF;

    SELECT * INTO current_direct
    FROM public.commission_plans
    WHERE code = 'partner_direct' AND is_active;

    SELECT * INTO current_franchise
    FROM public.commission_plans
    WHERE code = 'franchise_network' AND is_active;

    direct_commercial_bps := CASE
        WHEN current_direct.id IS NOT NULL THEN current_direct.commercial_share_bps
        WHEN current_franchise.id IS NOT NULL THEN greatest(
            current_franchise.commercial_share_bps + 1,
            10001 - current_franchise.central_share_bps
        )
        ELSE 7000
    END;
    direct_commercial_bps := least(10000, direct_commercial_bps);

    plan_result := public.version_commission_plan(
        actor_id,
        'partner_direct',
        'Verificación transaccional',
        direct_commercial_bps,
        0
    );

    IF plan_result->>'planId' IS NULL
       OR (SELECT count(*) FROM public.commission_plans WHERE code = 'partner_direct' AND is_active) <> 1
       OR (current_direct.id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.commission_plans WHERE id = current_direct.id AND is_active
       ))
    THEN
        RAISE EXCEPTION 'plan versioning did not close and replace the current version';
    END IF;

    INSERT INTO public.clients (owner_id, name, status)
    VALUES (actor_id, 'Fixture proporcional sin PII', 'in_process')
    RETURNING id INTO client_id;

    INSERT INTO public.contracts (
        client_id,
        agent_id,
        marketer_name,
        tariff_name,
        status,
        start_date,
        end_date,
        permanence_status
    ) VALUES (
        client_id,
        actor_id,
        'Fixture marketer',
        'Fixture tariff',
        'active',
        DATE '2026-01-01',
        DATE '2027-01-01',
        'known'
    )
    RETURNING id INTO contract_id;

    INSERT INTO public.network_commissions (
        agent_id,
        agent_commission,
        franchise_commission,
        status,
        lifecycle_status,
        reconciliation_status,
        client_id,
        contract_id,
        gross_supplier_commission,
        commercial_net_amount,
        franchise_royalty_amount,
        central_remainder_amount,
        plan_snapshot,
        policy_snapshot,
        calculation_snapshot
    ) VALUES (
        actor_id,
        600,
        100,
        'approved',
        'eligible',
        'ready',
        client_id,
        contract_id,
        1000,
        600,
        100,
        300,
        jsonb_build_object('code', 'fixture', 'version', 1),
        jsonb_build_object('code', 'proportional_permanence', 'version', 1),
        jsonb_build_object('source', 'verification')
    )
    RETURNING id INTO commission_id;

    adjustment_id := public.propose_permanence_decommission(
        commission_id,
        actor_id,
        DATE '2026-07-02',
        'Fixture documental de staging',
        NULL
    );
    repeated_adjustment_id := public.propose_permanence_decommission(
        commission_id,
        actor_id,
        DATE '2026-07-02',
        'Fixture documental de staging',
        NULL
    );

    SELECT * INTO adjustment
    FROM public.commission_adjustments
    WHERE id = adjustment_id;

    IF repeated_adjustment_id <> adjustment_id
       OR adjustment.reason_code <> 'permanence_breach'
       OR adjustment.permanence_total_days <> 365
       OR adjustment.active_days <> 182
       OR adjustment.permanence_remaining_days <> 183
       OR adjustment.reversal_bps <> 5014
       OR adjustment.gross_amount <> 501.40
       OR adjustment.commercial_amount <> 300.84
       OR adjustment.franchise_amount <> 50.14
       OR adjustment.central_amount <> 150.42
       OR adjustment.gross_amount <> adjustment.commercial_amount + adjustment.franchise_amount + adjustment.central_amount
    THEN
        RAISE EXCEPTION 'proportional permanence calculation is incorrect';
    END IF;

    PERFORM public.resolve_commission_adjustment(
        adjustment_id,
        actor_id,
        'confirmed',
        'Confirmación de verificación transaccional'
    );

    SELECT * INTO commission
    FROM public.network_commissions
    WHERE id = commission_id;

    IF commission.total_reversed_gross <> 501.40
       OR commission.total_reversed_commercial <> 300.84
       OR commission.total_reversed_franchise <> 50.14
       OR commission.total_reversed_central <> 150.42
    THEN
        RAISE EXCEPTION 'confirmed proportional adjustment did not update the ledger totals';
    END IF;

    RAISE NOTICE 'ok: plan versioning and proportional permanence verified';
END;
$$;

ROLLBACK;
