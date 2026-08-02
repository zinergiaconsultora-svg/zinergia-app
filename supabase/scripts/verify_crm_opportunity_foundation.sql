-- CRM opportunity foundation post-migration verification.
-- Target: staging first, then production after promotion.
-- Read-only: this script must return zero rows.

WITH expected_columns(table_name, column_name) AS (
    VALUES
        ('opportunities', 'client_id'),
        ('opportunities', 'supply_point_id'),
        ('opportunities', 'owner_id'),
        ('opportunities', 'franchise_id'),
        ('opportunities', 'type'),
        ('opportunities', 'stage'),
        ('opportunities', 'stage_entered_at'),
        ('opportunities', 'next_action_type'),
        ('opportunities', 'next_action_title'),
        ('opportunities', 'next_action_due_at'),
        ('opportunities', 'source_contract_id'),
        ('opportunity_stage_history', 'opportunity_id'),
        ('opportunity_stage_history', 'from_stage'),
        ('opportunity_stage_history', 'to_stage'),
        ('opportunity_stage_history', 'safe_metadata'),
        ('ocr_jobs', 'opportunity_id'),
        ('ocr_jobs', 'supply_point_id'),
        ('ocr_jobs', 'confirmed_at'),
        ('ocr_jobs', 'confirmed_by'),
        ('proposals', 'opportunity_id'),
        ('proposals', 'supply_point_id'),
        ('contracts', 'opportunity_id'),
        ('contracts', 'supply_point_id'),
        ('contracts', 'permanence_status'),
        ('network_commissions', 'opportunity_id'),
        ('tasks', 'opportunity_id')
),
expected_constraints(constraint_name) AS (
    VALUES
        ('opportunities_id_client_key'),
        ('opportunities_supply_point_client_fkey'),
        ('opportunities_open_next_action_check'),
        ('opportunities_renewal_source_check'),
        ('opportunity_history_metadata_object_check'),
        ('contracts_permanence_status_check'),
        ('contracts_permanence_value_check'),
        ('ocr_jobs_opportunity_client_fkey'),
        ('ocr_jobs_supply_point_client_fkey'),
        ('proposals_opportunity_client_fkey'),
        ('proposals_supply_point_client_fkey'),
        ('contracts_opportunity_client_fkey'),
        ('contracts_supply_point_client_fkey'),
        ('network_commissions_opportunity_fkey'),
        ('tasks_opportunity_client_fkey')
),
expected_indexes(index_name) AS (
    VALUES
        ('opportunities_one_open_cycle_per_supply'),
        ('opportunities_one_renewal_per_contract'),
        ('opportunities_owner_work_queue_idx'),
        ('opportunities_franchise_work_queue_idx'),
        ('opportunities_stage_age_idx'),
        ('opportunity_history_timeline_idx'),
        ('contracts_one_per_proposal_idx')
),
expected_policies(table_name, policy_name) AS (
    VALUES
        ('opportunities', 'opportunities_select_portfolio'),
        ('opportunity_stage_history', 'opportunity_history_select_portfolio')
),
blockers AS (
    SELECT
        'missing_column'::text AS check_type,
        expected.table_name || '.' || expected.column_name AS item
    FROM expected_columns expected
    WHERE NOT EXISTS (
        SELECT 1
        FROM information_schema.columns actual
        WHERE actual.table_schema = 'public'
          AND actual.table_name = expected.table_name
          AND actual.column_name = expected.column_name
    )

    UNION ALL

    SELECT
        'missing_constraint',
        expected.constraint_name
    FROM expected_constraints expected
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_constraint actual
        WHERE actual.conname = expected.constraint_name
    )

    UNION ALL

    SELECT
        'missing_index',
        expected.index_name
    FROM expected_indexes expected
    WHERE to_regclass('public.' || expected.index_name) IS NULL

    UNION ALL

    SELECT
        'missing_policy',
        expected.table_name || '.' || expected.policy_name
    FROM expected_policies expected
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_policies actual
        WHERE actual.schemaname = 'public'
          AND actual.tablename = expected.table_name
          AND actual.policyname = expected.policy_name
    )

    UNION ALL

    SELECT
        'rls_disabled',
        class.relname
    FROM pg_class class
    JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
    WHERE namespace.nspname = 'public'
      AND class.relname IN ('opportunities', 'opportunity_stage_history')
      AND NOT class.relrowsecurity

    UNION ALL

    SELECT
        'unexpected_authenticated_privilege',
        privilege.table_name || '.' || privilege.privilege_type
    FROM information_schema.role_table_grants privilege
    WHERE privilege.table_schema = 'public'
      AND privilege.table_name IN ('opportunities', 'opportunity_stage_history')
      AND privilege.grantee = 'authenticated'
      AND privilege.privilege_type <> 'SELECT'

    UNION ALL

    SELECT
        'unexpected_history_service_privilege',
        privilege.privilege_type
    FROM information_schema.role_table_grants privilege
    WHERE privilege.table_schema = 'public'
      AND privilege.table_name = 'opportunity_stage_history'
      AND privilege.grantee = 'service_role'
      AND privilege.privilege_type NOT IN ('SELECT', 'INSERT')

    UNION ALL

    SELECT
        'missing_append_only_trigger',
        'opportunity_stage_history.opportunity_history_append_only'
    WHERE NOT EXISTS (
        SELECT 1
        FROM pg_trigger trigger
        JOIN pg_class class ON class.oid = trigger.tgrelid
        JOIN pg_namespace namespace ON namespace.oid = class.relnamespace
        WHERE namespace.nspname = 'public'
          AND class.relname = 'opportunity_stage_history'
          AND trigger.tgname = 'opportunity_history_append_only'
          AND NOT trigger.tgisinternal
    )

    UNION ALL

    SELECT
        'public_trigger_function_execute',
        routine.routine_name
    FROM information_schema.routines routine
    WHERE routine.specific_schema = 'public'
      AND routine.routine_name IN (
          'set_opportunity_updated_at',
          'prevent_opportunity_history_mutation'
      )
      AND has_function_privilege(
          'public',
          format(
              'public.%I()',
              routine.routine_name
          ),
          'EXECUTE'
      )

    UNION ALL

    SELECT
        'missing_transition_function',
        'public.transition_crm_opportunity'
    WHERE to_regprocedure(
        'public.transition_crm_opportunity(uuid,text,text,uuid,text,jsonb,timestamptz,text)'
    ) IS NULL

    UNION ALL

    SELECT
        'unexpected_transition_execute',
        role_name
    FROM (
        VALUES ('public'), ('anon'), ('authenticated')
    ) AS roles(role_name)
    WHERE has_function_privilege(
        role_name,
        'public.transition_crm_opportunity(uuid,text,text,uuid,text,jsonb,timestamptz,text)',
        'EXECUTE'
    )

    UNION ALL

    SELECT
        'missing_transition_service_execute',
        'service_role'
    WHERE NOT has_function_privilege(
        'service_role',
        'public.transition_crm_opportunity(uuid,text,text,uuid,text,jsonb,timestamptz,text)',
        'EXECUTE'
    )

    UNION ALL

    SELECT
        'transactional_test_row_not_rolled_back',
        opportunity.id::text
    FROM public.opportunities opportunity
    WHERE opportunity.source = 'transactional_verification'
)
SELECT check_type, item
FROM blockers
ORDER BY check_type, item;
