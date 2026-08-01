-- Read-only verification for canonical contract renewals.
-- Expected result: one row with check_type = 'ok'.

WITH violations AS (
    SELECT 'missing_function'::text AS check_type, 'reconcile_contract_renewals'::text AS item
    WHERE to_regprocedure('public.reconcile_contract_renewals(date)') IS NULL

    UNION ALL
    SELECT 'missing_function', 'confirm_contract_permanence'
    WHERE to_regprocedure('public.confirm_contract_permanence(uuid,uuid,text,date)') IS NULL

    UNION ALL
    SELECT 'unexpected_execute_privilege', role_name || '.reconcile_contract_renewals'
    FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
    WHERE has_function_privilege(role_name, 'public.reconcile_contract_renewals(date)', 'EXECUTE')

    UNION ALL
    SELECT 'unexpected_execute_privilege', role_name || '.confirm_contract_permanence'
    FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
    WHERE has_function_privilege(role_name, 'public.confirm_contract_permanence(uuid,uuid,text,date)', 'EXECUTE')

    UNION ALL
    SELECT 'missing_service_execute', 'reconcile_contract_renewals'
    WHERE NOT has_function_privilege('service_role', 'public.reconcile_contract_renewals(date)', 'EXECUTE')

    UNION ALL
    SELECT 'missing_service_execute', 'confirm_contract_permanence'
    WHERE NOT has_function_privilege('service_role', 'public.confirm_contract_permanence(uuid,uuid,text,date)', 'EXECUTE')

    UNION ALL
    SELECT 'duplicate_renewal', source_contract_id::text
    FROM public.opportunities
    WHERE type = 'renewal'
    GROUP BY source_contract_id
    HAVING count(*) > 1

    UNION ALL
    SELECT 'duplicate_reminder', contract_id::text || ':' || threshold_days::text
    FROM public.contract_renewal_reminders
    GROUP BY contract_id, threshold_days
    HAVING count(*) > 1

    UNION ALL
    SELECT 'invalid_renewal_link', opportunity.id::text
    FROM public.opportunities opportunity
    JOIN public.contracts contract ON contract.id = opportunity.source_contract_id
    WHERE opportunity.type = 'renewal'
      AND (
          opportunity.client_id IS DISTINCT FROM contract.client_id
          OR opportunity.supply_point_id IS DISTINCT FROM contract.supply_point_id
          OR opportunity.owner_id IS DISTINCT FROM contract.agent_id
      )
)
SELECT check_type, item FROM violations
UNION ALL
SELECT 'ok', 'renewal structure, privileges and current integrity are valid'
WHERE NOT EXISTS (SELECT 1 FROM violations)
ORDER BY check_type, item;
