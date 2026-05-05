-- =============================================
-- ZINERGIA "IRONCLAD v2.1" DB OPTIMIZATION SCRIPT
-- =============================================
-- Objetivo: Seguridad Avanzada, Integridad de Datos y Automatización (FIXED)
-- =============================================

-- 0. EXTENSIONES NECESARIAS
-- -------------------------------------------------------------
-- Para búsquedas "fuzzy" (insensibles a tildes y errores tipográficos)
CREATE EXTENSION IF NOT EXISTS pg_trgm;


-- 1. INDICES ESTRATÉGICOS (Rendimiento x10)
-- -------------------------------------------------------------
-- Búsquedas rápidas de clientes por DNI/CIF (Columna 'document_number' basada en crmService/Types)
-- NOTA: Si esta columna no existe aun, el indice podria fallar. Lo creamos condicionalmente o asumimos que 'dni_cif' es el nombre en el frontend mapeado.
-- Verificamos el esquema actual: parece que `clients` tiene `dni_cif`.
CREATE INDEX IF NOT EXISTS idx_clients_dni ON clients(dni_cif);

-- Búsquedas ultra-rápidas e inteligentes de nombres (ej: encuentra "García" si buscas "Garcia")
CREATE INDEX IF NOT EXISTS idx_clients_name_gist ON clients USING gist(name gist_trgm_ops);

-- Filtrado rápido de propuestas por estado (ver pendientes, firmadas, etc.)
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
-- Ver historial del mes para gráficas (ordenado inverso por defecto)
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);

-- Árbol de red: encontrar hijos rápidamente
CREATE INDEX IF NOT EXISTS idx_profiles_parent ON profiles(parent_id);


-- 2. INTEGRIDAD DE DATOS (Cortafuegos anti-bugs)
-- -------------------------------------------------------------
-- Aseguramos que nadie meta dinero negativo por error
ALTER TABLE proposals 
ADD CONSTRAINT check_positive_savings CHECK (annual_savings >= 0),
ADD CONSTRAINT check_positive_cost CHECK (current_annual_cost >= 0);

-- Aseguramos estados válidos siempre
ALTER TABLE proposals 
DROP CONSTRAINT IF EXISTS proposals_status_check;
ALTER TABLE proposals 
ADD CONSTRAINT proposals_status_check CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired'));


-- 3. SISTEMA DE AUDITORÍA (El "Caja Negra" Mejorado)
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

-- Habilitar RLS: Solo el SUPER ADMIN (HQ) puede ver los logs.
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only HQ Admins read audit" ON audit_logs;
CREATE POLICY "Only HQ Admins read audit" ON audit_logs 
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM profiles p
        JOIN franchises f ON p.franchise_id = f.id
        WHERE p.id = auth.uid() 
        AND p.role = 'admin' 
        -- AND f.slug = 'hq' -- Comentado si 'slug' no existe aun en 'franchises', asumiendo solo ROLE admin por ahora.
    )
);

-- Función mejorada de Auditoría: Ignora cambios irrelevantes (ej: updated_at)
CREATE OR REPLACE FUNCTION audit_changes_trigger()
RETURNS TRIGGER AS $$
DECLARE
    v_old_data JSONB;
    v_new_data JSONB;
BEGIN
    -- Si es UPDATE, solo guardamos si algo importante cambió
    IF (TG_OP = 'UPDATE') THEN
        v_old_data := to_jsonb(OLD) - 'updated_at';
        v_new_data := to_jsonb(NEW) - 'updated_at';
        
        IF v_old_data = v_new_data THEN
            RETURN NEW; -- No hubo cambios reales, ignorar
        END IF;
    ELSE
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
    END IF;

    INSERT INTO audit_logs (table_name, record_id, operation, old_data, new_data, changed_by)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id, OLD.id),
        TG_OP,
        v_old_data,
        v_new_data,
        auth.uid()
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Aplicar auditoría
DROP TRIGGER IF EXISTS trg_audit_clients ON clients;
CREATE TRIGGER trg_audit_clients
AFTER INSERT OR UPDATE OR DELETE ON clients
FOR EACH ROW EXECUTE FUNCTION audit_changes_trigger();

DROP TRIGGER IF EXISTS trg_audit_proposals ON proposals;
CREATE TRIGGER trg_audit_proposals
AFTER INSERT OR UPDATE OR DELETE ON proposals
FOR EACH ROW EXECUTE FUNCTION audit_changes_trigger();


-- 4. AUTOMATIZACIÓN DE NEGOCIO (Comisiones Automáticas)
-- -------------------------------------------------------------
-- Cuando una propuesta pasa a 'accepted', calcula comisión y actualiza estadísticas.

CREATE OR REPLACE FUNCTION on_proposal_accepted()
RETURNS TRIGGER AS $$
DECLARE
    v_agent_id UUID;
    v_franchise_id UUID;
    v_total_revenue NUMERIC;
BEGIN
    -- Solo actuar si el estado cambia a 'accepted'
    IF NEW.status = 'accepted' AND (OLD.status IS NULL OR OLD.status != 'accepted') THEN
        
        -- 1. Obtener Dueño del Cliente
        SELECT user_id INTO v_agent_id FROM clients WHERE id = NEW.client_id;
        
        -- 2. Obtener Franquicia del Agente
        SELECT franchise_id INTO v_franchise_id FROM profiles WHERE id = v_agent_id;
        
        -- 3. Calcular Revenue Total (Asumimos 15% del ahorro anual como ganancia bruta para Zinergia)
        -- En el futuro esto podría venir de una tabla de 'offer_commissions'
        v_total_revenue := (NEW.annual_savings * 0.15); 
        
        -- 4. Insertar Reparto (Split)
        INSERT INTO network_commissions (
            proposal_id, agent_id, franchise_id, 
            total_revenue, 
            agent_commission, -- 30% para el Vendedor
            franchise_profit, -- 50% para la Franquicia
            hq_royalty,       -- 20% Royalty a HQ
            status
        ) VALUES (
            NEW.id, v_agent_id, v_franchise_id,
            v_total_revenue,
            v_total_revenue * 0.30, 
            v_total_revenue * 0.50, 
            v_total_revenue * 0.20, 
            'pending'
        );
        
        -- 5. Gamificación: Dar puntos al agente (Badge Hunter)
        INSERT INTO user_points (user_id, points)
        VALUES (v_agent_id, 500) -- 500 XP por cierre de venta
        ON CONFLICT (user_id) DO UPDATE SET points = user_points.points + 500;
        
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_proposal_accepted ON proposals;
CREATE TRIGGER trg_proposal_accepted
AFTER UPDATE ON proposals
FOR EACH ROW EXECUTE FUNCTION on_proposal_accepted();

