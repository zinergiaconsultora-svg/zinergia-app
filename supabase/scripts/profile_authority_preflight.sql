-- ZIN-SDD-041: read-only staging preflight.
--
-- This file is deliberately one SELECT statement because `supabase db query`
-- executes its input as a prepared statement. The companion PowerShell runner
-- requests a read-only connection and a statement timeout. The runner also
-- refuses non-staging refs and this file remains physically limited to one
-- aggregate SELECT, because poolers/clients may not preserve connection
-- options. The result records the effective transaction settings as evidence.
--
-- The result contains catalog metadata and aggregate counts only. It must never
-- be extended to return profile, invitation or Auth user identifiers or PII.

WITH RECURSIVE
roles(role_name) AS (
  VALUES ('PUBLIC'::text), ('anon'::text), ('authenticated'::text), ('service_role'::text)
),
profile_columns AS (
  SELECT a.attname AS column_name
  FROM pg_catalog.pg_attribute AS a
  JOIN pg_catalog.pg_class AS c ON c.oid = a.attrelid
  JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'profiles'
    AND a.attnum > 0
    AND NOT a.attisdropped
),
profile_walk AS (
  SELECT
    p.id AS root_id,
    p.parent_id AS next_id,
    ARRAY[p.id]::uuid[] AS visited,
    false AS cycle_found,
    1 AS depth
  FROM public.profiles AS p

  UNION ALL

  SELECT
    w.root_id,
    parent.parent_id,
    w.visited || parent.id,
    parent.id = ANY(w.visited),
    w.depth + 1
  FROM profile_walk AS w
  JOIN public.profiles AS parent ON parent.id = w.next_id
  WHERE NOT w.cycle_found
    AND w.depth < 100
),
profile_cycle_summary AS (
  SELECT
    count(DISTINCT root_id) FILTER (WHERE cycle_found)::bigint AS profiles_in_cycle,
    count(DISTINCT root_id) FILTER (WHERE depth = 100 AND next_id IS NOT NULL AND NOT cycle_found)::bigint AS depth_limit_hits
  FROM profile_walk
),
relevant_functions AS (
  SELECT
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_catalog.pg_get_function_identity_arguments(p.oid) AS identity_arguments,
    owner.rolname AS owner_name,
    owner.rolbypassrls AS owner_bypass_rls,
    p.prosecdef AS security_definer,
    coalesce(array_to_string(p.proconfig, ','), '') AS function_config,
    md5(pg_catalog.pg_get_functiondef(p.oid)) AS definition_md5,
    p.oid AS function_oid
  FROM pg_catalog.pg_proc AS p
  JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
  JOIN pg_catalog.pg_roles AS owner ON owner.oid = p.proowner
  WHERE n.nspname IN ('public', 'private')
    AND p.prokind IN ('f', 'p')
    AND (
      p.proname IN ('handle_new_user', 'is_admin', 'is_superadmin', 'get_my_parent_id', 'get_my_franchise_id')
      OR pg_catalog.pg_get_functiondef(p.oid) ILIKE '%profiles%'
      OR pg_catalog.pg_get_functiondef(p.oid) ILIKE '%network_invitations%'
    )
),
dependent_views AS (
  SELECT DISTINCT
    view_ns.nspname AS schema_name,
    view_class.relname AS view_name,
    CASE view_class.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' ELSE view_class.relkind::text END AS relation_kind,
    coalesce(array_to_string(view_class.reloptions, ','), '') AS relation_options,
    source_ns.nspname AS source_schema,
    source_class.relname AS source_relation
  FROM pg_catalog.pg_rewrite AS rw
  JOIN pg_catalog.pg_class AS view_class ON view_class.oid = rw.ev_class
  JOIN pg_catalog.pg_namespace AS view_ns ON view_ns.oid = view_class.relnamespace
  JOIN pg_catalog.pg_depend AS dep ON dep.objid = rw.oid
  JOIN pg_catalog.pg_class AS source_class ON source_class.oid = dep.refobjid
  JOIN pg_catalog.pg_namespace AS source_ns ON source_ns.oid = source_class.relnamespace
  WHERE view_class.relkind IN ('v', 'm')
    AND source_ns.nspname = 'public'
    AND source_class.relname IN ('profiles', 'network_invitations', 'franchises')
)
SELECT pg_catalog.jsonb_build_object(
  'database', pg_catalog.jsonb_build_object(
    'database_name', current_database(),
    'connected_role', current_user,
    'server_version', current_setting('server_version'),
    'transaction_read_only', current_setting('transaction_read_only'),
    'default_transaction_read_only', current_setting('default_transaction_read_only')
  ),
  'table_privileges', (
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'relation', relation_name,
        'role', role_name,
        'select', CASE WHEN role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c, LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) AS acl WHERE c.oid = pg_catalog.to_regclass('public.' || relation_name) AND acl.grantee = 0 AND acl.privilege_type = 'SELECT') ELSE has_table_privilege(role_name, 'public.' || relation_name, 'SELECT') END,
        'insert', CASE WHEN role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c, LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) AS acl WHERE c.oid = pg_catalog.to_regclass('public.' || relation_name) AND acl.grantee = 0 AND acl.privilege_type = 'INSERT') ELSE has_table_privilege(role_name, 'public.' || relation_name, 'INSERT') END,
        'update', CASE WHEN role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c, LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) AS acl WHERE c.oid = pg_catalog.to_regclass('public.' || relation_name) AND acl.grantee = 0 AND acl.privilege_type = 'UPDATE') ELSE has_table_privilege(role_name, 'public.' || relation_name, 'UPDATE') END,
        'delete', CASE WHEN role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c, LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) AS acl WHERE c.oid = pg_catalog.to_regclass('public.' || relation_name) AND acl.grantee = 0 AND acl.privilege_type = 'DELETE') ELSE has_table_privilege(role_name, 'public.' || relation_name, 'DELETE') END,
        'truncate', CASE WHEN role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c, LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) AS acl WHERE c.oid = pg_catalog.to_regclass('public.' || relation_name) AND acl.grantee = 0 AND acl.privilege_type = 'TRUNCATE') ELSE has_table_privilege(role_name, 'public.' || relation_name, 'TRUNCATE') END
      )
      ORDER BY relation_name, role_name
    )
    FROM (VALUES ('profiles'::text), ('network_invitations'::text), ('franchises'::text)) AS relations(relation_name)
    CROSS JOIN roles
  ),
  'profile_column_privileges', (
    SELECT pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'column', column_name,
        'role', role_name,
        'select', CASE WHEN role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c CROSS JOIN pg_catalog.pg_attribute AS a LEFT JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) AS table_acl ON true LEFT JOIN LATERAL pg_catalog.aclexplode(a.attacl) AS column_acl ON true WHERE c.oid = 'public.profiles'::regclass AND a.attrelid = c.oid AND a.attname = column_name AND ((table_acl.grantee = 0 AND table_acl.privilege_type = 'SELECT') OR (column_acl.grantee = 0 AND column_acl.privilege_type = 'SELECT'))) ELSE has_column_privilege(role_name, 'public.profiles', column_name, 'SELECT') END,
        'insert', CASE WHEN role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c CROSS JOIN pg_catalog.pg_attribute AS a LEFT JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) AS table_acl ON true LEFT JOIN LATERAL pg_catalog.aclexplode(a.attacl) AS column_acl ON true WHERE c.oid = 'public.profiles'::regclass AND a.attrelid = c.oid AND a.attname = column_name AND ((table_acl.grantee = 0 AND table_acl.privilege_type = 'INSERT') OR (column_acl.grantee = 0 AND column_acl.privilege_type = 'INSERT'))) ELSE has_column_privilege(role_name, 'public.profiles', column_name, 'INSERT') END,
        'update', CASE WHEN role_name = 'PUBLIC' THEN EXISTS (SELECT 1 FROM pg_catalog.pg_class AS c CROSS JOIN pg_catalog.pg_attribute AS a LEFT JOIN LATERAL pg_catalog.aclexplode(coalesce(c.relacl, pg_catalog.acldefault('r', c.relowner))) AS table_acl ON true LEFT JOIN LATERAL pg_catalog.aclexplode(a.attacl) AS column_acl ON true WHERE c.oid = 'public.profiles'::regclass AND a.attrelid = c.oid AND a.attname = column_name AND ((table_acl.grantee = 0 AND table_acl.privilege_type = 'UPDATE') OR (column_acl.grantee = 0 AND column_acl.privilege_type = 'UPDATE'))) ELSE has_column_privilege(role_name, 'public.profiles', column_name, 'UPDATE') END
      )
      ORDER BY column_name, role_name
    )
    FROM profile_columns
    CROSS JOIN roles
  ),
  'policies', (
    SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schema', schemaname,
        'table', tablename,
        'name', policyname,
        'permissive', permissive,
        'roles', roles,
        'command', cmd,
        'using', qual,
        'check', with_check
      )
      ORDER BY tablename, policyname
    ), '[]'::jsonb)
    FROM pg_catalog.pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'network_invitations', 'franchises')
  ),
  'functions', (
    SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schema', schema_name,
        'name', function_name,
        'identity_arguments', identity_arguments,
        'owner', owner_name,
        'owner_bypass_rls', owner_bypass_rls,
        'security_definer', security_definer,
        'config', function_config,
        'definition_md5', definition_md5,
        'execute', pg_catalog.jsonb_build_object(
          'PUBLIC', EXISTS (SELECT 1 FROM pg_catalog.pg_proc AS acl_proc, LATERAL pg_catalog.aclexplode(coalesce(acl_proc.proacl, pg_catalog.acldefault('f', acl_proc.proowner))) AS acl WHERE acl_proc.oid = function_oid AND acl.grantee = 0 AND acl.privilege_type = 'EXECUTE'),
          'anon', has_function_privilege('anon', function_oid, 'EXECUTE'),
          'authenticated', has_function_privilege('authenticated', function_oid, 'EXECUTE'),
          'service_role', has_function_privilege('service_role', function_oid, 'EXECUTE')
        )
      )
      ORDER BY schema_name, function_name, identity_arguments
    ), '[]'::jsonb)
    FROM relevant_functions
  ),
  'triggers', (
    SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schema', n.nspname,
        'table', c.relname,
        'name', t.tgname,
        'enabled', t.tgenabled,
        'definition', pg_catalog.pg_get_triggerdef(t.oid, true),
        'function_schema', fn_ns.nspname,
        'function_name', fn.proname
      )
      ORDER BY n.nspname, c.relname, t.tgname
    ), '[]'::jsonb)
    FROM pg_catalog.pg_trigger AS t
    JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
    JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
    JOIN pg_catalog.pg_proc AS fn ON fn.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace AS fn_ns ON fn_ns.oid = fn.pronamespace
    WHERE NOT t.tgisinternal
      AND (
        (n.nspname = 'public' AND c.relname IN ('profiles', 'network_invitations', 'franchises'))
        OR (n.nspname = 'auth' AND c.relname = 'users')
      )
  ),
  'dependent_views', (
    SELECT coalesce(pg_catalog.jsonb_agg(
      pg_catalog.jsonb_build_object(
        'schema', schema_name,
        'view', view_name,
        'kind', relation_kind,
        'options', relation_options,
        'source_schema', source_schema,
        'source_relation', source_relation
      )
      ORDER BY schema_name, view_name, source_relation
    ), '[]'::jsonb)
    FROM dependent_views
  ),
  'row_counts', pg_catalog.jsonb_build_object(
    'profiles', (SELECT count(*)::bigint FROM public.profiles),
    'auth_users', (SELECT count(*)::bigint FROM auth.users),
    'franchises', (SELECT count(*)::bigint FROM public.franchises),
    'network_invitations', (SELECT count(*)::bigint FROM public.network_invitations)
  ),
  'profile_quality', pg_catalog.jsonb_build_object(
    'invalid_role', (SELECT count(*)::bigint FROM public.profiles WHERE role IS NOT NULL AND role <> ALL (ARRAY['admin', 'franchise', 'agent'])),
    'neutral_with_non_null_authority', (SELECT count(*)::bigint FROM public.profiles WHERE role IS NULL AND (parent_id IS NOT NULL OR franchise_id IS NOT NULL)),
    'admin_noncanonical_tuple', (SELECT count(*)::bigint FROM public.profiles WHERE role = 'admin' AND (parent_id IS NOT NULL OR franchise_id IS NOT NULL)),
    'franchise_noncanonical_tuple', (
      SELECT count(*)::bigint
      FROM public.profiles AS p
      LEFT JOIN public.profiles AS parent ON parent.id = p.parent_id
      LEFT JOIN public.franchises AS f ON f.id = p.franchise_id
      WHERE p.role = 'franchise'
        AND (p.parent_id IS NULL OR p.franchise_id IS NULL OR parent.id IS NULL OR parent.role <> 'admin' OR f.id IS NULL OR f.is_active IS DISTINCT FROM true)
    ),
    'agent_noncanonical_tuple', (
      SELECT count(*)::bigint
      FROM public.profiles AS p
      LEFT JOIN public.profiles AS parent ON parent.id = p.parent_id
      LEFT JOIN public.franchises AS f ON f.id = p.franchise_id
      WHERE p.role = 'agent'
        AND (
          p.parent_id IS NULL OR p.franchise_id IS NULL OR parent.id IS NULL OR f.id IS NULL OR f.is_active IS DISTINCT FROM true
          OR NOT (parent.role = 'admin' OR (parent.role = 'franchise' AND parent.franchise_id = p.franchise_id))
        )
    ),
    'orphan_parent', (SELECT count(*)::bigint FROM public.profiles AS p LEFT JOIN public.profiles AS parent ON parent.id = p.parent_id WHERE p.parent_id IS NOT NULL AND parent.id IS NULL),
    'orphan_franchise', (SELECT count(*)::bigint FROM public.profiles AS p LEFT JOIN public.franchises AS f ON f.id = p.franchise_id WHERE p.franchise_id IS NOT NULL AND f.id IS NULL),
    'inactive_franchise_reference', (SELECT count(*)::bigint FROM public.profiles AS p JOIN public.franchises AS f ON f.id = p.franchise_id WHERE f.is_active IS DISTINCT FROM true),
    'self_parent', (SELECT count(*)::bigint FROM public.profiles WHERE parent_id = id),
    'profiles_in_cycle', (SELECT profiles_in_cycle FROM profile_cycle_summary),
    'cycle_depth_limit_hits', (SELECT depth_limit_hits FROM profile_cycle_summary),
    'canonical_active_admins', (SELECT count(*)::bigint FROM public.profiles WHERE role = 'admin' AND parent_id IS NULL AND franchise_id IS NULL),
    'auth_user_without_profile', (SELECT count(*)::bigint FROM auth.users AS u LEFT JOIN public.profiles AS p ON p.id = u.id WHERE p.id IS NULL),
    'neutral_auth_account', (SELECT count(*)::bigint FROM auth.users AS u JOIN public.profiles AS p ON p.id = u.id WHERE p.role IS NULL),
    'currently_banned_auth_account', (SELECT count(*)::bigint FROM auth.users WHERE banned_until > now())
  ),
  'invitation_quality', pg_catalog.jsonb_build_object(
    'unused_total', (SELECT count(*)::bigint FROM public.network_invitations WHERE used IS DISTINCT FROM true),
    'unused_expired', (SELECT count(*)::bigint FROM public.network_invitations WHERE used IS DISTINCT FROM true AND expires_at <= now()),
    'missing_creator', (SELECT count(*)::bigint FROM public.network_invitations AS i LEFT JOIN public.profiles AS c ON c.id = i.creator_id WHERE c.id IS NULL),
    'invalid_creator_authority', (
      SELECT count(*)::bigint
      FROM public.network_invitations AS i
      JOIN public.profiles AS c ON c.id = i.creator_id
      LEFT JOIN public.franchises AS f ON f.id = c.franchise_id
      WHERE c.role IS NULL
        OR c.role NOT IN ('admin', 'franchise')
        OR (c.role = 'franchise' AND (c.franchise_id IS NULL OR f.id IS NULL OR f.is_active IS DISTINCT FROM true))
    ),
    'legacy_franchise_to_franchise', (
      SELECT count(*)::bigint
      FROM public.network_invitations AS i
      JOIN public.profiles AS c ON c.id = i.creator_id
      WHERE i.used IS DISTINCT FROM true
        AND c.role = 'franchise'
        AND i.role = 'franchise'
    ),
    'invalid_requested_role', (SELECT count(*)::bigint FROM public.network_invitations WHERE role NOT IN ('agent', 'franchise'))
  )
) AS profile_authority_preflight;
