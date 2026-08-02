-- Read-only verification for 20260731191249_complete_crm_activation.sql.
-- Expected result: one row with check_type = 'ok'.

WITH violations AS (
    SELECT 'missing_function'::text AS check_type, 'public.complete_crm_activation'::text AS item
    WHERE to_regprocedure('public.complete_crm_activation(uuid,uuid,text,text,date,text,date)') IS NULL

    UNION ALL

    SELECT 'unexpected_execute_privilege', role_name
    FROM (VALUES ('anon'), ('authenticated')) AS roles(role_name)
    WHERE has_function_privilege(
        role_name,
        'public.complete_crm_activation(uuid,uuid,text,text,date,text,date)',
        'EXECUTE'
    )

    UNION ALL

    SELECT 'missing_service_execute', 'service_role'
    WHERE NOT has_function_privilege(
        'service_role',
        'public.complete_crm_activation(uuid,uuid,text,text,date,text,date)',
        'EXECUTE'
    )

    UNION ALL

    SELECT 'missing_view_column', expected.column_name
    FROM (VALUES ('opportunity_id'), ('supply_point_id')) AS expected(column_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns actual
        WHERE actual.table_schema = 'public'
          AND actual.table_name = 'proposals_alta'
          AND actual.column_name = expected.column_name
    )

    UNION ALL

    SELECT 'invalid_active_contract', contract.id::text
    FROM public.contracts contract
    WHERE contract.status = 'active'
      AND contract.opportunity_id IS NOT NULL
      AND (
          contract.proposal_id IS NULL
          OR contract.supply_point_id IS NULL
          OR contract.client_id IS NULL
          OR contract.agent_id IS NULL
          OR contract.start_date IS NULL
          OR contract.permanence_status NOT IN ('known', 'none', 'unknown')
          OR (contract.permanence_status = 'known' AND contract.end_date IS NULL)
          OR (contract.permanence_status = 'none' AND contract.end_date IS NOT NULL)
      )
)
SELECT check_type, item
FROM violations
UNION ALL
SELECT 'ok', 'activation workflow structure and active contracts are consistent'
WHERE NOT EXISTS (SELECT 1 FROM violations)
ORDER BY check_type, item;
