-- Reduce Supabase advisor debt without weakening RLS:
-- - Policies that depend on authenticated identity/helpers should not target
--   the broad public role.
-- - auth.uid() and helper functions are wrapped in SELECT so Postgres can
--   evaluate them once per statement instead of once per row.
-- - Public proposal-token flows remain anon-only and public franchise/invite
--   reads remain unchanged because they do not depend on authenticated state.

CREATE OR REPLACE FUNCTION pg_temp.zinergia_optimized_rls_expr(expr text)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF expr IS NULL THEN
    RETURN NULL;
  END IF;

  -- Protect already-optimized forms and helper names before plain replacement.
  expr := replace(expr, '(select auth.uid())', '__ZINERGIA_AUTH_UID__');
  expr := replace(expr, '( SELECT auth.uid() AS uid)', '__ZINERGIA_AUTH_UID__');

  expr := replace(expr, 'public.is_superadmin()', '__ZINERGIA_IS_SUPERADMIN__');
  expr := replace(expr, 'is_superadmin()', '__ZINERGIA_IS_SUPERADMIN__');
  expr := replace(expr, 'public.is_admin()', '__ZINERGIA_IS_ADMIN__');
  expr := replace(expr, 'is_admin()', '__ZINERGIA_IS_ADMIN__');
  expr := replace(expr, 'public.get_my_franchise_id()', '__ZINERGIA_MY_FRANCHISE__');
  expr := replace(expr, 'get_my_franchise_id()', '__ZINERGIA_MY_FRANCHISE__');
  expr := replace(expr, 'public.get_my_parent_id()', '__ZINERGIA_MY_PARENT__');
  expr := replace(expr, 'get_my_parent_id()', '__ZINERGIA_MY_PARENT__');

  expr := replace(expr, 'auth.uid()', '(select auth.uid())');

  expr := replace(expr, '__ZINERGIA_AUTH_UID__', '(select auth.uid())');
  expr := replace(expr, '__ZINERGIA_IS_SUPERADMIN__', '(select public.is_superadmin())');
  expr := replace(expr, '__ZINERGIA_IS_ADMIN__', '(select public.is_admin())');
  expr := replace(expr, '__ZINERGIA_MY_FRANCHISE__', '(select public.get_my_franchise_id())');
  expr := replace(expr, '__ZINERGIA_MY_PARENT__', '(select public.get_my_parent_id())');

  RETURN expr;
END;
$$;

DO $$
DECLARE
  policy record;
  statement text;
  optimized_using text;
  optimized_check text;
  role_clause text;
BEGIN
  FOR policy IN
    SELECT schemaname, tablename, policyname, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        coalesce(qual, '') ~ 'auth\.uid\(\)|(^|[^[:alnum:]_.])(public\.)?(is_admin|is_superadmin|get_my_franchise_id|get_my_parent_id)\(\)'
        OR coalesce(with_check, '') ~ 'auth\.uid\(\)|(^|[^[:alnum:]_.])(public\.)?(is_admin|is_superadmin|get_my_franchise_id|get_my_parent_id)\(\)'
      )
  LOOP
    optimized_using := pg_temp.zinergia_optimized_rls_expr(policy.qual);
    optimized_check := pg_temp.zinergia_optimized_rls_expr(policy.with_check);

    -- A public policy that depends on the current authenticated user is not a
    -- true public policy. Token-based proposal policies and public catalog
    -- policies are not matched by the WHERE clause above and stay public/anon.
    role_clause := CASE
      WHEN policy.roles = ARRAY['public']::name[] THEN ' TO authenticated'
      ELSE ''
    END;

    statement := format(
      'ALTER POLICY %I ON %I.%I%s',
      policy.policyname,
      policy.schemaname,
      policy.tablename,
      role_clause
    );

    IF optimized_using IS NOT NULL THEN
      statement := statement || format(' USING (%s)', optimized_using);
    END IF;

    IF optimized_check IS NOT NULL THEN
      statement := statement || format(' WITH CHECK (%s)', optimized_check);
    END IF;

    EXECUTE statement;
  END LOOP;
END;
$$;

-- After narrowing identity-dependent public policies to authenticated, anon no
-- longer needs direct EXECUTE on the RLS helper functions.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_franchise_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_parent_id() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_franchise_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_parent_id() TO authenticated, service_role;
