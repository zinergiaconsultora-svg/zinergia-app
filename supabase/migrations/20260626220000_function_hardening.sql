-- ════════════════════════════════════════════════════════════════════════════
-- Endurecimiento de funciones señaladas por el advisor (WARN). Cambios SEGUROS.
-- ════════════════════════════════════════════════════════════════════════════

-- ── A) search_path fijo (riesgo cero; no reescribe el cuerpo) ────────────────
ALTER FUNCTION public.get_dashboard_stats(uuid)                 SET search_path = public;
ALTER FUNCTION public.get_my_franchise_id()                    SET search_path = public;
ALTER FUNCTION public.handle_new_user()                        SET search_path = public;
ALTER FUNCTION public.handle_updated_at()                      SET search_path = public;
ALTER FUNCTION public.is_superadmin()                          SET search_path = public;
ALTER FUNCTION public.update_billing_cycles_updated_at()       SET search_path = public;
ALTER FUNCTION public.update_updated_at_column()               SET search_path = public;
ALTER FUNCTION public.log_client_status_transition()           SET search_path = public;
ALTER FUNCTION public.get_conversion_funnel(uuid)              SET search_path = public;
ALTER FUNCTION public.get_monthly_metrics(integer)             SET search_path = public;
ALTER FUNCTION public.get_expiring_contracts(integer)          SET search_path = public;
ALTER FUNCTION public.generate_invoice_number(uuid)            SET search_path = public;
ALTER FUNCTION public.update_withdrawal_requests_updated_at()  SET search_path = public;
ALTER FUNCTION public.get_withdrawal_growth(uuid)              SET search_path = public;
ALTER FUNCTION public.update_updated_at()                      SET search_path = public;

-- ── B) Quitar exposición RPC. OJO: Supabase concede EXECUTE DIRECTO a
--        anon/authenticated, no solo vía PUBLIC → revocar de ambos.
-- RPC analíticas: las llama `authenticated` desde la app; anon no las necesita.
DO $$
DECLARE fn text;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.generate_invoice_number(uuid)',
    'public.get_conversion_funnel(uuid)',
    'public.get_dashboard_stats(uuid)',
    'public.get_expiring_contracts(integer)',
    'public.get_monthly_metrics(integer)',
    'public.get_withdrawal_growth(uuid)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', fn);
  END LOOP;
END $$;

-- purge_expired_clients: solo service role (cron + RGPD)
REVOKE EXECUTE ON FUNCTION public.purge_expired_clients() FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.purge_expired_clients() TO service_role;

-- Funciones de trigger: nunca se invocan por RPC
REVOKE EXECUTE ON FUNCTION public.handle_new_user()              FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_client_status_transition() FROM PUBLIC, anon, authenticated;

-- ── NOTA INTENCIONAL ─────────────────────────────────────────────────────────
-- is_admin / is_superadmin / get_my_franchise_id / get_my_parent_id NO se
-- revocan: las policies con rol `public` (que incluye anon) las invocan al
-- evaluar el RLS (p. ej. la firma de propuestas públicas por usuarios anónimos).
-- Revocarlas rompería el RLS. Su exposición RPC devuelve solo datos del propio
-- llamante (anon → false/null), por lo que no constituye fuga.
