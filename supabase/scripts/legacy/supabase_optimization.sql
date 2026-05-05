-- =============================================
-- ZINERGIA "IRONCLAD" DB OPTIMIZATION SCRIPT
-- =============================================
-- Objetivo: Seguridad, Rendimiento y Automatización
-- =============================================

-- 1. INDICES ESTRATÉGICOS (Rendimiento x10)
-- -------------------------------------------------------------
-- Búsquedas rápidas de clientes por DNI/CIF (muy común)
CREATE INDEX IF NOT EXISTS idx_clients_dni ON clients(nif_cif);
-- Búsquedas rápidas de clientes por Nombre (para el buscador del dashboard)
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON clients USING gin(name gin_trgm_ops);

-- Filtrado rápido de propuestas por estado (ver pendientes, firmadas, etc.)
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
-- Ver historial del mes para gráficas
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- Árbol de red: encontrar hijos rápidamente
CREATE INDEX IF NOT EXISTS idx_profiles_parent ON profiles(parent_id);


-- 2. SISTEMA DE AUDITORÍA (El "Caja Negra")
-- -------------------------------------------------------------
-- Tabla inmutable para registrar quién hizo qué
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    table_name TEXT NOT NULL,
    record_id UUID,
    operation TEXT CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES profiles(id), -- El usuario que hizo el cambio
    changed_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS: Solo admins pueden LEER logs. NADIE puede borrarlos ni editarlos.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read audit" ON audit_logs FOR SELECT USING (public.check_is_admin());
-- Sin policies de INSERT/UPDATE/DELETE para usuarios normales, solo el sistema (triggers) escribe aquí.

-- Función genérica para el Trigger de Auditoría
CREATE OR REPLACE FUNCTION audit_changes_trigger()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (table_name, record_id, operation, old_data, new_data, changed_by)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        to_jsonb(OLD),
        to_jsonb(NEW),
        auth.uid() -- Captura el usuario logueado automáticamente
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar auditoría a tablas críticas (Dinero y Clientes)
DROP TRIGGER IF EXISTS trg_audit_clients ON clients;
CREATE TRIGGER trg_audit_clients
AFTER INSERT OR UPDATE OR DELETE ON clients
FOR EACH ROW EXECUTE FUNCTION audit_changes_trigger();

DROP TRIGGER IF EXISTS trg_audit_proposals ON proposals;
CREATE TRIGGER trg_audit_proposals
AFTER INSERT OR UPDATE OR DELETE ON proposals
FOR EACH ROW EXECUTE FUNCTION audit_changes_trigger();

DROP TRIGGER IF EXISTS trg_audit_commissions ON network_commissions;
CREATE TRIGGER trg_audit_commissions
AFTER INSERT OR UPDATE OR DELETE ON network_commissions
FOR EACH ROW EXECUTE FUNCTION audit_changes_trigger();


-- 3. AUTOMATIZACIÓN DE NEGOCIO (Trigger de Éxito)
-- -------------------------------------------------------------
-- Cuando una propuesta pasa a 'accepted', calcula comisión y actualiza estadísticas automáticamente.

CREATE OR REPLACE FUNCTION on_proposal_accepted()
RETURNS TRIGGER AS $$
DECLARE
    v_agent_id UUID;
    v_franchise_id UUID;
    v_revenue NUMERIC;
BEGIN
    -- Solo actuar si el estado cambia a 'accepted'
    IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
        
        -- Obtener datos del agente propietario del cliente
        SELECT user_id INTO v_agent_id FROM clients WHERE id = NEW.client_id;
        
        -- Obtener franquicia del agente
        SELECT franchise_id INTO v_franchise_id FROM profiles WHERE id = v_agent_id;
        
        -- Calcular Revenue base (Ej: 15% del ahorro, o un valor fijo por ahora)
        v_revenue := (NEW.annual_savings * 0.15); 
        
        -- Insertar Comisión Pendiente Automáticamente
        INSERT INTO network_commissions (
            proposal_id, agent_id, franchise_id, 
            total_revenue, agent_commission, franchise_profit, hq_royalty,
            status
        ) VALUES (
            NEW.id, v_agent_id, v_franchise_id,
            v_revenue,
            v_revenue * 0.30, -- 30% para Agente
            v_revenue * 0.50, -- 50% para Franquicia
            v_revenue * 0.20, -- 20% para HQ
            'pending'
        );
        
        -- Gamificación: Dar puntos al agente
        INSERT INTO user_points (user_id, points)
        VALUES (v_agent_id, 100) -- 100 puntos por venta
        ON CONFLICT (user_id) DO UPDATE SET points = user_points.points + 100;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_proposal_accepted ON proposals;
CREATE TRIGGER trg_proposal_accepted
AFTER UPDATE ON proposals
FOR EACH ROW EXECUTE FUNCTION on_proposal_accepted();

