-- Follow-up to 20260629102514: those helpers are now only used by
-- authenticated-scoped RLS policies, so anon no longer needs EXECUTE.

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_superadmin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_franchise_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_parent_id() FROM anon;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_superadmin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_franchise_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_my_parent_id() TO authenticated, service_role;
