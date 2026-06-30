-- Safe fixes from Supabase advisors:
-- - SIPS cache is only accessed server-side through service_role.
-- - supply_points/switch_events already have FOR ALL policies, so separate
--   SELECT policies are duplicate work.
-- - tariff_commissions had two identical company indexes.

-- SIPS cache: remove broad authenticated direct access. The API route uses
-- src/lib/supabase/service.ts, so service_role is the only writer/reader needed.
DROP POLICY IF EXISTS "Authenticated users can manage SIPS cache" ON public.sips_consumption_cache;
DROP POLICY IF EXISTS "Authenticated users can read SIPS cache" ON public.sips_consumption_cache;
DROP POLICY IF EXISTS "Service role can manage SIPS cache" ON public.sips_consumption_cache;

REVOKE ALL ON TABLE public.sips_consumption_cache FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.sips_consumption_cache TO service_role;

-- Remove duplicate SELECT policies; FOR ALL policy covers SELECT with same scope.
DROP POLICY IF EXISTS "Users can view supply points in their franchise" ON public.supply_points;
DROP POLICY IF EXISTS "Users can view switch events in their franchise" ON public.switch_events;

-- Remove duplicate btree index on tariff_commissions(company).
DROP INDEX IF EXISTS public.idx_tc_company;
