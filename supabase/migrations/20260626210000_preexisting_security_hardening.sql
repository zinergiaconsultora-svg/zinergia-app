-- ════════════════════════════════════════════════════════════════════════════
-- Auditoría de seguridad: objetos PREEXISTENTES señalados por el advisor de
-- Supabase (no creados por la feature de altas). Corrige fugas reales.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) Vistas SECURITY DEFINER → security_invoker ────────────────────────────
-- Una vista security-definer ignora el RLS de las tablas base y corre como su
-- propietario, exponiendo datos a cualquier rol con SELECT (incluido anon).
-- Con security_invoker la vista respeta el RLS del usuario que consulta.
--   · franchise_wallet          → financiero por franquicia (network_commissions)
--   · v_clients_expiring_soon    → PII de clientes (RGPD, vía service role)
--   · v_franchise_client_stats   → métricas por franquicia
--   · v_proposal_funnel          → embudo de propuestas
--   · v_active_tariffs / v_tariff_stats → catálogo de tarifas
ALTER VIEW public.franchise_wallet          SET (security_invoker = on);
ALTER VIEW public.v_active_tariffs          SET (security_invoker = on);
ALTER VIEW public.v_franchise_client_stats  SET (security_invoker = on);
ALTER VIEW public.v_proposal_funnel         SET (security_invoker = on);
ALTER VIEW public.v_tariff_stats            SET (security_invoker = on);
ALTER VIEW public.v_clients_expiring_soon   SET (security_invoker = on);

REVOKE ALL ON public.franchise_wallet          FROM anon;
REVOKE ALL ON public.v_active_tariffs          FROM anon;
REVOKE ALL ON public.v_franchise_client_stats  FROM anon;
REVOKE ALL ON public.v_proposal_funnel         FROM anon;
REVOKE ALL ON public.v_tariff_stats            FROM anon;
REVOKE ALL ON public.v_clients_expiring_soon   FROM anon;

-- ── 2) user_points: RLS activo SIN policy = todo denegado (gamificación rota) ─
-- La app lee/escribe los puntos del propio usuario desde el navegador.
DROP POLICY IF EXISTS rls_user_points_select ON public.user_points;
CREATE POLICY rls_user_points_select ON public.user_points FOR SELECT
    USING (user_id = auth.uid() OR is_superadmin());

DROP POLICY IF EXISTS rls_user_points_insert ON public.user_points;
CREATE POLICY rls_user_points_insert ON public.user_points FOR INSERT
    WITH CHECK (user_id = auth.uid() OR is_superadmin());

DROP POLICY IF EXISTS rls_user_points_update ON public.user_points;
CREATE POLICY rls_user_points_update ON public.user_points FOR UPDATE
    USING (user_id = auth.uid() OR is_superadmin())
    WITH CHECK (user_id = auth.uid() OR is_superadmin());

-- ── 3) franchise_config: RLS activo SIN policy = lecturas de usuario en vacío ─
-- Antes los nombres de empresa / royalties no se mostraban en la UI de red.
-- Scope: propio + downline directo + admin.
DROP POLICY IF EXISTS rls_franchise_config_select ON public.franchise_config;
CREATE POLICY rls_franchise_config_select ON public.franchise_config FOR SELECT
    USING (
        is_superadmin()
        OR franchise_id = auth.uid()
        OR franchise_id = get_my_franchise_id()
        OR franchise_id IN (SELECT id FROM public.profiles WHERE parent_id = auth.uid())
    );

DROP POLICY IF EXISTS rls_franchise_config_insert ON public.franchise_config;
CREATE POLICY rls_franchise_config_insert ON public.franchise_config FOR INSERT
    WITH CHECK (is_superadmin() OR franchise_id = auth.uid());

DROP POLICY IF EXISTS rls_franchise_config_update ON public.franchise_config;
CREATE POLICY rls_franchise_config_update ON public.franchise_config FOR UPDATE
    USING (is_superadmin() OR franchise_id = auth.uid())
    WITH CHECK (is_superadmin() OR franchise_id = auth.uid());

REVOKE ALL ON public.user_points      FROM anon;
REVOKE ALL ON public.franchise_config FROM anon;

-- ── 4) integration_credentials: SE DEJA INTACTA A PROPÓSITO ──────────────────
-- RLS activo + sin policy + sin grants = solo accesible por service_role.
-- Es la tabla de secretos (tokens de Google Drive); deny-all es el estado
-- correcto. Añadir una policy permisiva la debilitaría. No se modifica.
