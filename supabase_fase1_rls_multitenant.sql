-- =============================================
-- FASE 1: RLS MULTITENANT AISLADO POR FRANQUICIA (v2 - AUDITADO)
-- =============================================
-- Instrucciones: Ejecutar este script en el SQL Editor de Supabase
-- =============================================

-- =============================================
-- 1. HELPER FUNCTIONS (SECURITY DEFINER = bypassa RLS internamente)
-- =============================================

-- Obtiene el franchise_id del usuario autenticado.
-- STABLE: el resultado no cambia dentro de una misma transacción SQL.
CREATE OR REPLACE FUNCTION get_my_franchise_id()
RETURNS UUID AS $$
    SELECT franchise_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Comprueba si el usuario autenticado es superadmin.
CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS BOOLEAN AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- =============================================
-- 2. CLIENTS (Multitenant por Franquicia)
-- =============================================
-- Limpiar TODAS las políticas previas (incluidas las del setup original)
DROP POLICY IF EXISTS "Users can see own clients" ON clients;
DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
DROP POLICY IF EXISTS "Users can update own clients" ON clients;
DROP POLICY IF EXISTS "Admins can see all clients" ON clients;
DROP POLICY IF EXISTS "SuperAdmins view all clients" ON clients;
DROP POLICY IF EXISTS "SuperAdmins update all clients" ON clients;
DROP POLICY IF EXISTS "SuperAdmins insert all clients" ON clients;
DROP POLICY IF EXISTS "SuperAdmins delete all clients" ON clients;
DROP POLICY IF EXISTS "Agents view franchise clients" ON clients;
DROP POLICY IF EXISTS "Agents update franchise clients" ON clients;
DROP POLICY IF EXISTS "Agents insert franchise clients" ON clients;

-- SuperAdmin: acceso total
CREATE POLICY "rls_clients_admin_all" ON clients
    FOR ALL USING (is_superadmin());

-- Agentes: SELECT solo por franchise_id O owner_id propio
CREATE POLICY "rls_clients_agent_select" ON clients
    FOR SELECT USING (
        franchise_id = get_my_franchise_id() OR owner_id = auth.uid()
    );

-- Agentes: INSERT forzando que franchise_id coincida con el suyo
-- FIX v2: El owner_id en INSERT SIEMPRE debe ser auth.uid() para evitar suplantación
CREATE POLICY "rls_clients_agent_insert" ON clients
    FOR INSERT WITH CHECK (
        owner_id = auth.uid()
        AND (franchise_id IS NULL OR franchise_id = get_my_franchise_id())
    );

-- Agentes: UPDATE solo sus propios clientes (no los de otro agente de la misma franquicia)
CREATE POLICY "rls_clients_agent_update" ON clients
    FOR UPDATE USING (
        owner_id = auth.uid()
    );

-- Agentes: DELETE prohibido (solo admin puede borrar)
-- No se crea policy de DELETE para agentes = denegado por defecto


-- =============================================
-- 3. PROPOSALS (Multitenant por Franquicia)
-- =============================================
DROP POLICY IF EXISTS "Users can see own proposals" ON proposals;
DROP POLICY IF EXISTS "Users can insert own proposals" ON proposals;
DROP POLICY IF EXISTS "Users can update own proposals" ON proposals;
DROP POLICY IF EXISTS "SuperAdmins view all proposals" ON proposals;
DROP POLICY IF EXISTS "SuperAdmins update all proposals" ON proposals;
DROP POLICY IF EXISTS "SuperAdmins insert all proposals" ON proposals;
DROP POLICY IF EXISTS "SuperAdmins delete all proposals" ON proposals;
DROP POLICY IF EXISTS "Agents view franchise proposals" ON proposals;
DROP POLICY IF EXISTS "Agents update franchise proposals" ON proposals;
DROP POLICY IF EXISTS "Agents insert franchise proposals" ON proposals;

-- SuperAdmin: acceso total
CREATE POLICY "rls_proposals_admin_all" ON proposals
    FOR ALL USING (is_superadmin());

-- Agentes: SELECT por franchise_id directo (ruta rápida) o via ownership del cliente
CREATE POLICY "rls_proposals_agent_select" ON proposals
    FOR SELECT USING (
        franchise_id = get_my_franchise_id()
        OR EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = proposals.client_id
            AND clients.owner_id = auth.uid()
        )
    );

-- Agentes: INSERT solo si el cliente les pertenece
-- FIX v2: Verificar ownership del cliente, no solo franchise_id
CREATE POLICY "rls_proposals_agent_insert" ON proposals
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = client_id
            AND clients.owner_id = auth.uid()
        )
    );

-- Agentes: UPDATE solo propuestas de sus propios clientes
CREATE POLICY "rls_proposals_agent_update" ON proposals
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM clients
            WHERE clients.id = proposals.client_id
            AND clients.owner_id = auth.uid()
        )
    );

-- Agentes: DELETE prohibido (solo admin)


-- =============================================
-- 4. NETWORK_COMMISSIONS (Datos financieros sensibles)
-- =============================================
DROP POLICY IF EXISTS "Users can see own commissions" ON network_commissions;
DROP POLICY IF EXISTS "Admins can see all commissions" ON network_commissions;

CREATE POLICY "rls_commissions_admin_all" ON network_commissions
    FOR ALL USING (is_superadmin());

-- Agentes solo ven SUS comisiones (no las de otros agentes de su franquicia)
CREATE POLICY "rls_commissions_agent_select" ON network_commissions
    FOR SELECT USING (
        agent_id = auth.uid() OR franchise_id = auth.uid()
    );


-- =============================================
-- 5. COMMISSION_TRACKING (Mirror de comisiones)
-- =============================================
DROP POLICY IF EXISTS "Users can see own commissions" ON commission_tracking;
DROP POLICY IF EXISTS "Admins can see all commissions" ON commission_tracking;

CREATE POLICY "rls_commission_tracking_admin_all" ON commission_tracking
    FOR ALL USING (is_superadmin());

CREATE POLICY "rls_commission_tracking_agent_select" ON commission_tracking
    FOR SELECT USING (
        agent_id = auth.uid() OR franchise_id = auth.uid()
    );


-- =============================================
-- 6. OFFERS (Aislamiento de planes especiales)
-- =============================================
DROP POLICY IF EXISTS "Users can view offers" ON offers;
DROP POLICY IF EXISTS "Users can manage offers" ON offers;
DROP POLICY IF EXISTS "SuperAdmin manages all offers" ON offers;
DROP POLICY IF EXISTS "Agents view global or franchise offers" ON offers;

CREATE POLICY "rls_offers_admin_all" ON offers
    FOR ALL USING (is_superadmin());

-- Agents ven ofertas globales (franchise_id IS NULL) o de su propia franquicia
CREATE POLICY "rls_offers_agent_select" ON offers
    FOR SELECT USING (
        franchise_id IS NULL OR franchise_id = get_my_franchise_id()
    );


-- =============================================
-- 7. NETWORK_INVITATIONS (Prevenir creación de invitaciones falsas)
-- =============================================
DROP POLICY IF EXISTS "Creators see own invitations" ON network_invitations;

CREATE POLICY "rls_invitations_admin_all" ON network_invitations
    FOR ALL USING (is_superadmin());

CREATE POLICY "rls_invitations_creator_select" ON network_invitations
    FOR SELECT USING (creator_id = auth.uid());

-- Solo el creador puede insertar, y el creator_id DEBE ser auth.uid()
CREATE POLICY "rls_invitations_creator_insert" ON network_invitations
    FOR INSERT WITH CHECK (creator_id = auth.uid());


-- =============================================
-- VERIFICACIÓN: Listar todas las políticas RLS activas
-- =============================================
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
