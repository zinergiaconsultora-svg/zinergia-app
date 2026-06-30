BEGIN;

-- Keep RLS helpers out of the exposed public schema. The public wrappers stay
-- in place but are no longer executable by API roles after policies move to
-- private.* helpers.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.get_my_franchise_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT franchise_id
  FROM public.profiles
  WHERE id = (select auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.get_my_parent_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT parent_id
  FROM public.profiles
  WHERE id = (select auth.uid());
$$;

CREATE OR REPLACE FUNCTION private.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (select auth.uid())
      AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION private.is_superadmin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = (select auth.uid())
      AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.get_my_franchise_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.get_my_parent_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION private.is_superadmin() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.get_my_franchise_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_my_parent_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_superadmin() TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.get_my_franchise_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_parent_id() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION pg_temp.zinergia_policy_expr(expr text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF expr IS NULL THEN
    RETURN NULL;
  END IF;

  expr := replace(expr, '( SELECT auth.uid() AS uid)', '__Z_AUTH_UID__');
  expr := replace(expr, '(select auth.uid())', '__Z_AUTH_UID__');

  expr := replace(expr, '( SELECT public.is_superadmin() AS is_superadmin)', '__Z_IS_SUPERADMIN__');
  expr := replace(expr, '( SELECT is_superadmin() AS is_superadmin)', '__Z_IS_SUPERADMIN__');
  expr := replace(expr, 'public.is_superadmin()', '__Z_IS_SUPERADMIN__');
  expr := replace(expr, 'is_superadmin()', '__Z_IS_SUPERADMIN__');

  expr := replace(expr, '( SELECT public.is_admin() AS is_admin)', '__Z_IS_ADMIN__');
  expr := replace(expr, '( SELECT is_admin() AS is_admin)', '__Z_IS_ADMIN__');
  expr := replace(expr, 'public.is_admin()', '__Z_IS_ADMIN__');
  expr := replace(expr, 'is_admin()', '__Z_IS_ADMIN__');

  expr := replace(expr, '( SELECT public.get_my_franchise_id() AS get_my_franchise_id)', '__Z_MY_FRANCHISE__');
  expr := replace(expr, '( SELECT get_my_franchise_id() AS get_my_franchise_id)', '__Z_MY_FRANCHISE__');
  expr := replace(expr, 'public.get_my_franchise_id()', '__Z_MY_FRANCHISE__');
  expr := replace(expr, 'get_my_franchise_id()', '__Z_MY_FRANCHISE__');

  expr := replace(expr, '( SELECT public.get_my_parent_id() AS get_my_parent_id)', '__Z_MY_PARENT__');
  expr := replace(expr, '( SELECT get_my_parent_id() AS get_my_parent_id)', '__Z_MY_PARENT__');
  expr := replace(expr, 'public.get_my_parent_id()', '__Z_MY_PARENT__');
  expr := replace(expr, 'get_my_parent_id()', '__Z_MY_PARENT__');

  expr := replace(expr, 'auth.uid()', '(select auth.uid())');

  expr := replace(expr, '__Z_AUTH_UID__', '(select auth.uid())');
  expr := replace(expr, '__Z_IS_SUPERADMIN__', '(select private.is_superadmin())');
  expr := replace(expr, '__Z_IS_ADMIN__', '(select private.is_admin())');
  expr := replace(expr, '__Z_MY_FRANCHISE__', '(select private.get_my_franchise_id())');
  expr := replace(expr, '__Z_MY_PARENT__', '(select private.get_my_parent_id())');

  RETURN expr;
END;
$$;

CREATE TEMP TABLE zinergia_policy_source ON COMMIT DROP AS
SELECT
  p.schemaname,
  p.tablename,
  p.policyname,
  p.cmd,
  r.role_name,
  pg_temp.zinergia_policy_expr(p.qual) AS using_expr,
  pg_temp.zinergia_policy_expr(p.with_check) AS check_expr
FROM pg_policies p
CROSS JOIN LATERAL (
  VALUES ('anon'::name), ('authenticated'::name)
) AS r(role_name)
WHERE p.schemaname = 'public'
  AND (
    (r.role_name = 'anon'::name AND ('anon'::name = ANY (p.roles) OR 'public'::name = ANY (p.roles)))
    OR (r.role_name = 'authenticated'::name AND ('authenticated'::name = ANY (p.roles) OR 'public'::name = ANY (p.roles)))
  );

CREATE TEMP TABLE zinergia_policy_expanded ON COMMIT DROP AS
SELECT
  schemaname,
  tablename,
  role_name,
  action,
  CASE
    WHEN action IN ('SELECT', 'DELETE', 'UPDATE') THEN coalesce(using_expr, 'true')
    ELSE NULL
  END AS using_expr,
  CASE
    WHEN action = 'INSERT' THEN coalesce(check_expr, using_expr, 'true')
    WHEN action = 'UPDATE' THEN coalesce(check_expr, using_expr, 'true')
    ELSE NULL
  END AS check_expr
FROM zinergia_policy_source
CROSS JOIN LATERAL (
  VALUES ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')
) AS actions(action)
WHERE cmd = 'ALL' OR cmd = action;

DO $$
DECLARE
  existing_policy record;
  target record;
  policy_name text;
  using_sql text;
  check_sql text;
BEGIN
  FOR existing_policy IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  END LOOP;

  FOR target IN
    SELECT DISTINCT schemaname, tablename, role_name, action
    FROM zinergia_policy_expanded
    ORDER BY schemaname, tablename, role_name, action
  LOOP
    policy_name := format(
      'rls_%s_%s_%s',
      target.tablename,
      CASE WHEN target.role_name = 'authenticated'::name THEN 'auth' ELSE target.role_name::text END,
      lower(target.action)
    );

    IF length(policy_name) > 63 THEN
      policy_name := left(policy_name, 54) || '_' || substr(md5(policy_name), 1, 8);
    END IF;

    SELECT string_agg(DISTINCT '(' || using_expr || ')', ' OR ')
    INTO using_sql
    FROM zinergia_policy_expanded
    WHERE schemaname = target.schemaname
      AND tablename = target.tablename
      AND role_name = target.role_name
      AND action = target.action
      AND using_expr IS NOT NULL;

    SELECT string_agg(DISTINCT '(' || check_expr || ')', ' OR ')
    INTO check_sql
    FROM zinergia_policy_expanded
    WHERE schemaname = target.schemaname
      AND tablename = target.tablename
      AND role_name = target.role_name
      AND action = target.action
      AND check_expr IS NOT NULL;

    IF target.action = 'SELECT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR SELECT TO %I USING (%s)',
        policy_name,
        target.schemaname,
        target.tablename,
        target.role_name,
        coalesce(using_sql, 'true')
      );
    ELSIF target.action = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR INSERT TO %I WITH CHECK (%s)',
        policy_name,
        target.schemaname,
        target.tablename,
        target.role_name,
        coalesce(check_sql, 'true')
      );
    ELSIF target.action = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR UPDATE TO %I USING (%s) WITH CHECK (%s)',
        policy_name,
        target.schemaname,
        target.tablename,
        target.role_name,
        coalesce(using_sql, 'true'),
        coalesce(check_sql, using_sql, 'true')
      );
    ELSIF target.action = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I.%I FOR DELETE TO %I USING (%s)',
        policy_name,
        target.schemaname,
        target.tablename,
        target.role_name,
        coalesce(using_sql, 'true')
      );
    END IF;
  END LOOP;
END;
$$;

COMMIT;
