-- ==========================================
-- TABLA 1: Historial de Simulaciones
-- ==========================================

CREATE TABLE IF NOT EXISTS simulation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invoice_data JSONB NOT NULL,
    results JSONB NOT NULL,
    is_mock BOOLEAN DEFAULT false,
    total_savings DECIMAL(10, 2) NOT NULL,
    best_offer_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Crear índice para búsquedas rápidas (CORREGIDO)
CREATE INDEX IF NOT EXISTS idx_simulation_history_user_created
ON simulation_history(user_id, created_at DESC);

-- Activar seguridad a nivel de fila (RLS)
ALTER TABLE simulation_history ENABLE ROW LEVEL SECURITY;

-- Política: Los usuarios pueden VER sus propias simulaciones
CREATE POLICY "Users can view their own simulations"
    ON simulation_history FOR SELECT
    USING (auth.uid() = user_id);

-- Política: Los usuarios pueden INSERTAR sus propias simulaciones
CREATE POLICY "Users can insert their own simulations"
    ON simulation_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política: Los usuarios pueden ELIMINAR sus propias simulaciones
CREATE POLICY "Users can delete their own simulations"
    ON simulation_history FOR DELETE
    USING (auth.uid() = user_id);

-- ==========================================
-- TABLA 2: Simulaciones Compartidas
-- ==========================================

CREATE TABLE IF NOT EXISTS shared_simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id UUID REFERENCES simulation_history(id) ON DELETE CASCADE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Crear índice para búsquedas por slug (CORREGIDO)
CREATE INDEX IF NOT EXISTS idx_shared_simulations_slug
ON shared_simulations(slug);

-- Activar seguridad RLS
ALTER TABLE shared_simulations ENABLE ROW LEVEL SECURITY;

-- Política: CUALQUIERA puede ver simulaciones compartidas
CREATE POLICY "Anyone can view shared simulations"
    ON shared_simulations FOR SELECT
    USING (true);

-- ==========================================
-- FUNCIÓN: Limpiar shares expirados
-- ==========================================

CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS void AS $$
BEGIN
    DELETE FROM shared_simulations
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;
