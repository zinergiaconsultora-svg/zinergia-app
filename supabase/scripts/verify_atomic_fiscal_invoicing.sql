-- Target: staging first, then production after approval.
-- Read-only structural verification. A successful run returns zero rows.
WITH expected_relations(item) AS (
    VALUES
        ('public.fiscal_organizations'),
        ('public.self_billing_agreements'),
        ('public.fiscal_document_sequences'),
        ('public.fiscal_invoice_commission_lines'),
        ('public.fiscal_rectification_requests')
),
expected_functions(item) AS (
    VALUES
        ('public.configure_fiscal_organization(uuid,text,text,text,text,text,text)'),
        ('public.create_commission_invoice_draft(uuid,uuid[],uuid)'),
        ('public.accept_self_billed_invoice(uuid,uuid)'),
        ('public.transition_fiscal_invoice(uuid,text,uuid,text,text,text)'),
        ('public.create_rectifying_invoice_draft(uuid,uuid)'),
        ('public.get_fiscal_admin_setup(uuid)'),
        ('public.get_my_self_billing_status(uuid)')
),
missing_relations AS (
    SELECT 'missing_relation' AS check_type, item
    FROM expected_relations WHERE to_regclass(item) IS NULL
),
missing_functions AS (
    SELECT 'missing_function' AS check_type, item
    FROM expected_functions WHERE to_regprocedure(item) IS NULL
),
privilege_errors AS (
    SELECT 'unexpected_privilege' AS check_type, item
    FROM (VALUES
        ('authenticated can insert invoices', has_table_privilege('authenticated', 'public.invoices', 'INSERT')),
        ('authenticated can update invoices', has_table_privilege('authenticated', 'public.invoices', 'UPDATE')),
        ('authenticated can delete invoices', has_table_privilege('authenticated', 'public.invoices', 'DELETE')),
        ('anon can read fiscal organizations', has_table_privilege('anon', 'public.fiscal_organizations', 'SELECT')),
        ('anon can read self-billing agreements', has_table_privilege('anon', 'public.self_billing_agreements', 'SELECT')),
        ('anon can read fiscal commission lines', has_table_privilege('anon', 'public.fiscal_invoice_commission_lines', 'SELECT')),
        ('authenticated can insert fiscal lines', has_table_privilege('authenticated', 'public.fiscal_invoice_commission_lines', 'INSERT')),
        ('authenticated can update self-billing agreements', has_table_privilege('authenticated', 'public.self_billing_agreements', 'UPDATE')),
        ('authenticated can delete rectification requests', has_table_privilege('authenticated', 'public.fiscal_rectification_requests', 'DELETE')),
        ('authenticated can create fiscal draft', has_function_privilege('authenticated', 'public.create_commission_invoice_draft(uuid,uuid[],uuid)', 'EXECUTE')),
        ('anon can create fiscal draft', has_function_privilege('anon', 'public.create_commission_invoice_draft(uuid,uuid[],uuid)', 'EXECUTE')),
        ('authenticated can use legacy numbering', has_function_privilege('authenticated', 'public.generate_invoice_number(uuid)', 'EXECUTE'))
    ) privilege(item, is_present)
    WHERE is_present
),
missing_guards AS (
    SELECT 'missing_guard' AS check_type, item
    FROM (VALUES
        ('active commission uniqueness', to_regclass('public.fiscal_invoice_active_commission_idx') IS NOT NULL),
        ('fiscal profile mutation trigger', EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'guard_fiscal_profile_mutation' AND tgrelid = 'public.profiles'::regclass AND NOT tgisinternal
        )),
        ('rectification queue trigger', EXISTS (
            SELECT 1 FROM pg_trigger
            WHERE tgname = 'queue_fiscal_rectification_after_adjustment'
              AND tgrelid = 'public.commission_adjustments'::regclass AND NOT tgisinternal
        )),
        ('service role fiscal draft execute', has_function_privilege('service_role', 'public.create_commission_invoice_draft(uuid,uuid[],uuid)', 'EXECUTE'))
    ) guard(item, is_present)
    WHERE NOT is_present
),
missing_policies AS (
    SELECT 'missing_policy' AS check_type, item
    FROM (VALUES
        ('fiscal organizations admin read', EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fiscal_organizations' AND policyname = 'fiscal_organizations_admin_read'
        )),
        ('self-billing scoped read', EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'self_billing_agreements' AND policyname = 'self_billing_agreements_scoped_read'
        )),
        ('fiscal lines scoped read', EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fiscal_invoice_commission_lines' AND policyname = 'fiscal_lines_scoped_read'
        )),
        ('rectification requests scoped read', EXISTS (
            SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'fiscal_rectification_requests' AND policyname = 'rectification_requests_scoped_read'
        ))
    ) policy(item, is_present)
    WHERE NOT is_present
)
SELECT * FROM missing_relations
UNION ALL SELECT * FROM missing_functions
UNION ALL SELECT * FROM privilege_errors
UNION ALL SELECT * FROM missing_guards
UNION ALL SELECT * FROM missing_policies
ORDER BY check_type, item;
