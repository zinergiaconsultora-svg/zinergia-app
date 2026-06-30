-- service_role bypasses RLS in Supabase, so these permissive policies are
-- redundant and trigger auth_rls_initplan/multiple-policy advisor warnings.

DROP POLICY IF EXISTS "Service role full access on renewals" ON public.renewal_opportunities;
DROP POLICY IF EXISTS "Service role full access on actions" ON public.next_actions;
