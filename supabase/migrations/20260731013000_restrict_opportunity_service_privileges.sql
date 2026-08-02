-- Supabase default privileges grant service_role more than the opportunity
-- workflow needs. Restrict history to append-only access at the grant layer.

REVOKE ALL ON public.opportunities FROM service_role;
REVOKE ALL ON public.opportunity_stage_history FROM service_role;

GRANT SELECT, INSERT, UPDATE ON public.opportunities TO service_role;
GRANT SELECT, INSERT ON public.opportunity_stage_history TO service_role;
