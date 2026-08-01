-- Read-only staging verification for ZIN-SDD-040 T6.
-- Expected result: no rows.

WITH expected_columns(column_name) AS (
    VALUES
        ('opportunity_id'),
        ('client_id'),
        ('supply_point_id'),
        ('owner_id'),
        ('franchise_id'),
        ('type'),
        ('stage'),
        ('client_name'),
        ('supply_label'),
        ('stage_entered_at'),
        ('stage_age_days'),
        ('next_action_type'),
        ('next_action_title'),
        ('next_action_due_at'),
        ('due_group'),
        ('owner_name')
),
actual_columns AS (
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_work_queue'
),
missing_columns AS (
    SELECT 'missing_column' AS check_type, column_name AS item
    FROM expected_columns
    EXCEPT
    SELECT 'missing_column', column_name
    FROM actual_columns
),
unexpected_columns AS (
    SELECT 'unexpected_column' AS check_type, column_name AS item
    FROM actual_columns
    EXCEPT
    SELECT 'unexpected_column', column_name
    FROM expected_columns
),
view_configuration AS (
    SELECT 'invalid_view_configuration' AS check_type, 'public.crm_work_queue' AS item
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_class relation
        JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
        WHERE namespace.nspname = 'public'
          AND relation.relname = 'crm_work_queue'
          AND relation.relkind = 'v'
          AND 'security_invoker=true' = ANY (relation.reloptions)
          AND 'security_barrier=true' = ANY (relation.reloptions)
    )
),
invalid_privileges AS (
    SELECT 'invalid_privilege' AS check_type, grantee || ':' || privilege_type AS item
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = 'crm_work_queue'
      AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
      AND (
          grantee NOT IN ('authenticated', 'service_role')
          OR privilege_type <> 'SELECT'
      )
),
missing_privileges AS (
    SELECT 'missing_privilege' AS check_type, role_name || ':SELECT' AS item
    FROM (VALUES ('authenticated'), ('service_role')) AS required(role_name)
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.role_table_grants grant_row
        WHERE grant_row.table_schema = 'public'
          AND grant_row.table_name = 'crm_work_queue'
          AND grant_row.grantee = required.role_name
          AND grant_row.privilege_type = 'SELECT'
    )
),
leaked_test_fixtures AS (
    SELECT 'leaked_test_fixture' AS check_type, opportunity_id::text AS item
    FROM public.crm_work_queue
    WHERE client_name LIKE 'CRM queue RLS test%'
)
SELECT * FROM missing_columns
UNION ALL SELECT * FROM unexpected_columns
UNION ALL SELECT * FROM view_configuration
UNION ALL SELECT * FROM invalid_privileges
UNION ALL SELECT * FROM missing_privileges
UNION ALL SELECT * FROM leaked_test_fixtures
ORDER BY check_type, item;
