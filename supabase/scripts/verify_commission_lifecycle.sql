DO $$
DECLARE
    missing text[] := ARRAY[]::text[];
BEGIN
    IF to_regclass('public.commission_plans') IS NULL THEN missing := array_append(missing, 'commission_plans'); END IF;
    IF to_regclass('public.commission_plan_assignments') IS NULL THEN missing := array_append(missing, 'commission_plan_assignments'); END IF;
    IF to_regclass('public.commission_decommission_policies') IS NULL THEN missing := array_append(missing, 'commission_decommission_policies'); END IF;
    IF to_regclass('public.commission_events') IS NULL THEN missing := array_append(missing, 'commission_events'); END IF;
    IF to_regclass('public.commission_adjustments') IS NULL THEN missing := array_append(missing, 'commission_adjustments'); END IF;
    IF to_regclass('public.commission_reconciliation_queue') IS NULL THEN missing := array_append(missing, 'commission_reconciliation_queue'); END IF;

    IF array_length(missing, 1) IS NOT NULL THEN
        RAISE EXCEPTION 'missing commission relations: %', array_to_string(missing, ', ');
    END IF;

    IF to_regprocedure('public.assign_commission_plan(uuid,uuid,uuid,text,timestamp with time zone)') IS NULL
       OR to_regprocedure('public.initialize_commission_lifecycle(uuid)') IS NULL
       OR to_regprocedure('public.transition_commission_lifecycle(uuid,text,uuid,text)') IS NULL
       OR to_regprocedure('public.propose_commission_adjustment(uuid,uuid,text,integer,integer,text,uuid)') IS NULL
       OR to_regprocedure('public.resolve_commission_adjustment(uuid,uuid,text,text)') IS NULL
    THEN
        RAISE EXCEPTION 'missing protected commission workflow';
    END IF;

    IF has_function_privilege('anon', 'public.initialize_commission_lifecycle(uuid)', 'EXECUTE')
       OR has_function_privilege('authenticated', 'public.initialize_commission_lifecycle(uuid)', 'EXECUTE')
       OR NOT has_function_privilege('service_role', 'public.initialize_commission_lifecycle(uuid)', 'EXECUTE')
    THEN
        RAISE EXCEPTION 'invalid commission initialization privileges';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.network_commissions
        WHERE gross_supplier_commission IS NOT NULL
          AND gross_supplier_commission <> commercial_net_amount + franchise_royalty_amount + central_remainder_amount
    ) THEN
        RAISE EXCEPTION 'unbalanced canonical commission allocation';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.network_commissions
        WHERE total_reversed_gross <> total_reversed_commercial + total_reversed_franchise + total_reversed_central
           OR (gross_supplier_commission IS NOT NULL AND total_reversed_gross > gross_supplier_commission)
    ) THEN
        RAISE EXCEPTION 'invalid commission reversal totals';
    END IF;
END;
$$;

SELECT 'ok' AS commission_lifecycle_verification;
