-- =============================================
-- CONTRACTS — Lifecycle + alertas de vencimiento
-- =============================================

CREATE TABLE IF NOT EXISTS contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id),

    marketer_name TEXT NOT NULL,
    tariff_name TEXT,
    contract_type TEXT NOT NULL DEFAULT 'electricidad' CHECK (contract_type IN ('electricidad', 'gas', 'dual')),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending_switch', 'cancelled', 'expired')),

    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE,
    notice_date DATE,

    annual_savings NUMERIC(10,2),
    monthly_cost_estimate NUMERIC(10,2),

    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contracts_client ON contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_agent ON contracts(agent_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_end_date ON contracts(end_date) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_contracts_franchise ON contracts(franchise_id);

ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent sees own contracts"
    ON contracts FOR SELECT
    USING (agent_id = auth.uid());

CREATE POLICY "Agent manages own contracts"
    ON contracts FOR ALL
    USING (agent_id = auth.uid());

CREATE POLICY "Franchise sees franchise contracts"
    ON contracts FOR SELECT
    USING (
        franchise_id IN (
            SELECT franchise_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin manages all contracts"
    ON contracts FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP TRIGGER IF EXISTS contracts_updated_at ON contracts;
CREATE TRIGGER contracts_updated_at
    BEFORE UPDATE ON contracts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Función para obtener contratos próximos a vencer
CREATE OR REPLACE FUNCTION get_expiring_contracts(p_days_threshold INTEGER DEFAULT 90)
RETURNS TABLE (
    id UUID,
    client_id UUID,
    client_name TEXT,
    agent_id UUID,
    marketer_name TEXT,
    tariff_name TEXT,
    end_date DATE,
    days_remaining INTEGER,
    annual_savings NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.client_id,
        cl.name,
        c.agent_id,
        c.marketer_name,
        c.tariff_name,
        c.end_date,
        (c.end_date - CURRENT_DATE)::INTEGER,
        c.annual_savings
    FROM contracts c
    JOIN clients cl ON cl.id = c.client_id
    WHERE c.status = 'active'
      AND c.end_date IS NOT NULL
      AND c.end_date <= CURRENT_DATE + p_days_threshold
      AND c.end_date >= CURRENT_DATE
    ORDER BY c.end_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificación
SELECT
    'contracts' AS tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'contracts'
ORDER BY ordinal_position;

SELECT
    'RLS' AS info,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'contracts'
ORDER BY policyname;
