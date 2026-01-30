-- =============================================
-- ZINERGIA - SUPABASE COMPLETE SETUP
-- =============================================
-- Ejecutar TODO en una sola vez en el SQL Editor de Supabase
-- https://jycwgzdrysesfcxgrxwg.supabase.co
-- =============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- PART 1: TARIFAS SETUP (34 tariffs)
-- =============================================

-- Create tarifas table
CREATE TABLE IF NOT EXISTS lv_zinergia_tarifas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    company TEXT NOT NULL,
    tariff_name TEXT NOT NULL,
    tariff_type TEXT,
    offer_type TEXT CHECK (offer_type IN ('fixed', 'indexed')) DEFAULT 'fixed',
    contract_duration TEXT DEFAULT '12 meses',
    power_price_p1 NUMERIC NOT NULL DEFAULT 0,
    power_price_p2 NUMERIC NOT NULL DEFAULT 0,
    power_price_p3 NUMERIC NOT NULL DEFAULT 0,
    power_price_p4 NUMERIC NOT NULL DEFAULT 0,
    power_price_p5 NUMERIC NOT NULL DEFAULT 0,
    power_price_p6 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p1 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p2 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p3 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p4 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p5 NUMERIC NOT NULL DEFAULT 0,
    energy_price_p6 NUMERIC NOT NULL DEFAULT 0,
    connection_fee NUMERIC DEFAULT 0,
    fixed_fee NUMERIC DEFAULT 0,
    logo_color TEXT DEFAULT 'bg-slate-600',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    CONSTRAINT unique_tariff UNIQUE (company, tariff_name)
);

-- Insert 2.0TD tariffs (24 from CSV)
INSERT INTO lv_zinergia_tarifas (company, tariff_name, tariff_type, power_price_p1, power_price_p2, power_price_p3, energy_price_p1, energy_price_p2, energy_price_p3, connection_fee) VALUES
    ('GANA ENERGIA', '24 HRS', '2.0TD', 0.089, 0.089, 0.089, 0.111, 0.111, 0.111, 0.6),
    ('GANA ENERGIA', '3 PERIODOS', '2.0TD', 0.089, 0.089, 0.089, 0.163, 0.096, 0.072, 0.6),
    ('WEKIWI', 'IMPULSA ENERGIA', '2.0TD', 0.092, 0.092, 0.092, 0.129, 0.129, 0.129, 0.6),
    ('WEKIWI', 'PROMO', '2.0TD', 0.092, 0.092, 0.092, 0.155, 0.155, 0.155, 0.6),
    ('ENDESA', 'LIBRE CON PERMANENCIA', '2.0TD', 0.088, 0.088, 0.088, 0.109, 0.109, 0.109, 0.6),
    ('ENDESA', 'LIBRE SIN PERMANENCIA', '2.0TD', 0.088, 0.088, 0.088, 0.119, 0.119, 0.119, 0.6),
    ('TOTAL ENERGIES', 'A TU AIRE SIEMPRE', '2.0TD', 0.071, 0.071, 0.071, 0.134, 0.134, 0.134, 0.6),
    ('TOTAL ENERGIES', 'PROGRAMA TU AHORRO', '2.0TD', 0.071, 0.071, 0.071, 0.201, 0.132, 0.096, 0.6),
    ('IBERDROLA', 'ONLINE', '2.0TD', 0.108, 0.046, 0.046, 0.119, 0.119, 0.119, 0.6),
    ('NATURGY', 'POR USO', '2.0TD', 0.1102, 0.03346, 0.03346, 0.1204, 0.1204, 0.1204, 0.6),
    ('NATURGY', 'NOCHE', '2.0TD', 0.1102, 0.03346, 0.03346, 0.1904, 0.1175, 0.082, 0.6),
    ('HOLALUZ', 'HOLA ENERGIA', '2.0TD', 0.096, 0.096, 0.096, 0.13, 0.13, 0.13, 0.6),
    ('ELEIA', 'BALANCE 2', '2.0TD', 0.081, 0.081, 0.081, 0.119, 0.119, 0.119, 0.6),
    ('VISALIA', 'FIJO FLIX', '2.0TD', 0.082, 0.082, 0.082, 0.135, 0.135, 0.135, 0.6),
    ('VISALIA', 'FIJO', '2.0TD', 0.098, 0.098, 0.098, 0.123, 0.123, 0.123, 0.6),
    ('OPCION ENERGIA', 'PRESENCIAL', '2.0TD', 0.111, 0.111, 0.111, 0.116, 0.116, 0.116, 0.6),
    ('IMAGINA', 'UNICO PLUS', '2.0TD', 0.127, 0.059, 0.059, 0.134, 0.134, 0.134, 0.6),
    ('IMAGINA', '3 PERIODOS PLUS', '2.0TD', 0.127, 0.059, 0.059, 0.211, 0.137, 0.102, 0.6),
    ('NORDY', '24 HORAS', '2.0TD', 0.079, 0.079, 0.079, 0.119, 0.119, 0.119, 0.6),
    ('REPSOL', 'FIJO ALTO VALOR', '2.0TD', 0.081, 0.081, 0.081, 0.139, 0.139, 0.139, 0.6),
    ('REPSOL', 'FIJO MEDIO VALOR', '2.0TD', 0.081, 0.081, 0.081, 0.119, 0.119, 0.119, 0.6),
    ('REPSOL', 'FIJO BAJO VALOR', '2.0TD', 0.081, 0.081, 0.081, 0.109, 0.109, 0.109, 0.6),
    ('ENUCA', 'ZURITA', '2.0TD', 0.129, 0.072, 0.072, 0.09, 0.09, 0.09, 0.6),
    ('ENUCA', 'BARROS', '2.0TD', 0.129, 0.072, 0.072, 0.1, 0.1, 0.1, 0.6)
ON CONFLICT (company, tariff_name) DO NOTHING;

-- Insert 3.0TD and 3.1TD tariffs (10 additional)
INSERT INTO lv_zinergia_tarifas (company, tariff_name, tariff_type, offer_type, power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6, energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6, connection_fee, logo_color, contract_duration) VALUES
    ('Endesa', 'Conecta 3.0TD', '3.0TD', 'fixed', 0.092, 0.055, 0.035, 0.015, 0.015, 0.015, 0.145, 0.125, 0.115, 0.105, 0.095, 0.095, 0, 'bg-blue-500', '12 meses'),
    ('Iberdrola', 'Plan 3.0TD', '3.0TD', 'fixed', 0.082, 0.052, 0.032, 0.015, 0.015, 0.015, 0.155, 0.135, 0.125, 0.115, 0.105, 0.105, 0, 'bg-green-600', '24 meses'),
    ('Naturgy', 'Tarifa 3.0TD', '3.0TD', 'fixed', 0.095, 0.058, 0.038, 0.018, 0.018, 0.018, 0.138, 0.118, 0.108, 0.098, 0.098, 0.098, 0, 'bg-blue-600', '12 meses'),
    ('Repsol', '3.0TD Empresa', '3.0TD', 'fixed', 0.088, 0.053, 0.033, 0.015, 0.015, 0.015, 0.142, 0.122, 0.112, 0.102, 0.092, 0.092, 0, 'bg-red-600', '12 meses'),
    ('TotalEnergies', '3.0TD Indexada', '3.0TD', 'indexed', 0.072, 0.042, 0.022, 0.012, 0.012, 0.012, 0.135, 0.115, 0.105, 0.095, 0.085, 0.085, 0, 'bg-yellow-500', '12 meses'),
    ('Endesa', 'Conecta 3.1TD', '3.1TD', 'fixed', 0.095, 0.058, 0.038, 0.020, 0.015, 0.010, 0.150, 0.130, 0.120, 0.110, 0.100, 0.090, 0, 'bg-blue-500', '12 meses'),
    ('Iberdrola', 'Plan 3.1TD', '3.1TD', 'fixed', 0.085, 0.055, 0.035, 0.020, 0.015, 0.010, 0.160, 0.140, 0.130, 0.120, 0.110, 0.100, 0, 'bg-green-600', '24 meses'),
    ('Naturgy', 'Tarifa 3.1TD', '3.1TD', 'fixed', 0.098, 0.060, 0.040, 0.022, 0.017, 0.012, 0.143, 0.123, 0.113, 0.103, 0.093, 0.083, 0, 'bg-blue-600', '12 meses'),
    ('Repsol', '3.1TD Empresa', '3.1TD', 'fixed', 0.091, 0.055, 0.035, 0.020, 0.015, 0.010, 0.147, 0.127, 0.117, 0.107, 0.097, 0.087, 0, 'bg-red-600', '12 meses'),
    ('TotalEnergies', '3.1TD Indexada', '3.1TD', 'indexed', 0.075, 0.045, 0.025, 0.015, 0.010, 0.008, 0.140, 0.120, 0.110, 0.100, 0.090, 0.080, 0, 'bg-yellow-500', '12 meses')
ON CONFLICT (company, tariff_name) DO NOTHING;

-- Indexes for tarifas
CREATE INDEX IF NOT EXISTS idx_tarifas_company ON lv_zinergia_tarifas(company);
CREATE INDEX IF NOT EXISTS idx_tarifas_type ON lv_zinergia_tarifas(tariff_type);
CREATE INDEX IF NOT EXISTS idx_tarifas_active ON lv_zinergia_tarifas(is_active);
CREATE INDEX IF NOT EXISTS idx_tarifas_offer_type ON lv_zinergia_tarifas(offer_type);

-- Enable RLS
ALTER TABLE lv_zinergia_tarifas ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Authenticated users can view active tariffs" ON lv_zinergia_tarifas;
CREATE POLICY "Authenticated users can view active tariffs"
    ON lv_zinergia_tarifas FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_lv_zinergia_tarifas_updated_at ON lv_zinergia_tarifas;
CREATE TRIGGER update_lv_zinergia_tarifas_updated_at
    BEFORE UPDATE ON lv_zinergia_tarifas
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Views
CREATE OR REPLACE VIEW v_active_tariffs AS
SELECT id, company, tariff_name, tariff_type, offer_type, contract_duration, logo_color,
       power_price_p1, power_price_p2, power_price_p3, power_price_p4, power_price_p5, power_price_p6,
       energy_price_p1, energy_price_p2, energy_price_p3, energy_price_p4, energy_price_p5, energy_price_p6,
       connection_fee, fixed_fee, updated_at
FROM lv_zinergia_tarifas
WHERE is_active = TRUE
ORDER BY company, tariff_name;

CREATE OR REPLACE VIEW v_tariff_stats AS
SELECT tariff_type, offer_type,
       COUNT(*) as total_tariffs,
       COUNT(*) FILTER (WHERE is_active = TRUE) as active_tariffs,
       AVG(power_price_p1) as avg_power_p1,
       AVG(energy_price_p1) as avg_energy_p1,
       AVG(connection_fee) as avg_connection_fee
FROM lv_zinergia_tarifas
GROUP BY tariff_type, offer_type
ORDER BY tariff_type, offer_type;

-- =============================================
-- PART 2: OPTIMIZACIONES E ÍNDICES
-- =============================================

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_clients_franchise_id ON clients(franchise_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_franchise_id ON proposals(franchise_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_annual_savings ON proposals(annual_savings DESC);

CREATE INDEX IF NOT EXISTS idx_invitations_code ON network_invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON network_invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_commissions_proposal_id ON network_commissions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_commissions_agent_id ON network_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON network_commissions(status);

CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_points ON user_points(points DESC);

-- Add updated_at columns if missing
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE proposals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
CREATE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- PART 3: VIEWS PARA DASHBOARD
-- =============================================

CREATE OR REPLACE VIEW v_franchise_client_stats AS
SELECT f.id as franchise_id, f.company_name,
       COUNT(DISTINCT c.id) as total_clients,
       COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'won') as active_clients,
       COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('new', 'contacted', 'in_process')) as pending_clients,
       COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'new') as new_clients,
       SUM(c.average_monthly_bill) FILTER (WHERE c.status = 'won') as total_monthly_revenue
FROM profiles f
LEFT JOIN clients c ON c.franchise_id = f.id
WHERE f.role = 'franchise' OR f.role = 'admin'
GROUP BY f.id, f.company_name
ORDER BY total_clients DESC;

CREATE OR REPLACE VIEW v_proposal_funnel AS
SELECT p.status,
       COUNT(*) as count,
       SUM(p.annual_savings) as total_savings,
       AVG(p.annual_savings) as avg_savings,
       COUNT(DISTINCT p.franchise_id) as franchises_involved
FROM proposals p
WHERE p.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.status
ORDER BY CASE p.status
    WHEN 'draft' THEN 1
    WHEN 'sent' THEN 2
    WHEN 'accepted' THEN 3
    WHEN 'rejected' THEN 4
    WHEN 'expired' THEN 5
END;

CREATE OR REPLACE VIEW v_top_performers AS
SELECT p.id as user_id, p.full_name, p.role,
       COUNT(DISTINCT prop.id) FILTER (WHERE prop.status = 'accepted') as closed_deals,
       SUM(prop.annual_savings) FILTER (WHERE prop.status = 'accepted') as total_savings_generated,
       SUM(nc.agent_commission) FILTER (WHERE nc.status = 'paid') as total_earned,
       up.points, up.badges
FROM profiles p
LEFT JOIN proposals prop ON prop.client_id IN (SELECT id FROM clients WHERE owner_id = p.id)
LEFT JOIN network_commissions nc ON nc.agent_id = p.id
LEFT JOIN user_points up ON up.user_id = p.id
GROUP BY p.id, p.full_name, p.role, up.points, up.badges
ORDER BY closed_deals DESC, total_savings_generated DESC
LIMIT 20;

-- =============================================
-- PART 4: HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INT AS $$
DECLARE deleted_count INT;
BEGIN
    DELETE FROM network_invitations
    WHERE expires_at < NOW() - INTERVAL '30 days' AND used = FALSE;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE (table_name TEXT, issue_type TEXT, count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 'clients'::TEXT, 'orphaned_franchise'::TEXT, COUNT(*)
    FROM clients c LEFT JOIN franchises f ON c.franchise_id = f.id
    WHERE c.franchise_id IS NOT NULL AND f.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- PART 5: GRANT PERMISSIONS
-- =============================================

GRANT SELECT ON v_active_tariffs TO authenticated;
GRANT SELECT ON v_tariff_stats TO authenticated;
GRANT SELECT ON v_franchise_client_stats TO authenticated;
GRANT SELECT ON v_proposal_funnel TO authenticated;
GRANT SELECT ON v_top_performers TO authenticated;

GRANT EXECUTE ON FUNCTION cleanup_expired_invitations TO authenticated;
GRANT EXECUTE ON FUNCTION check_data_integrity TO authenticated;

-- =============================================
-- VERIFICATION
-- =============================================

-- Show results
SELECT 'lv_zinergia_tarifas' as table_name, COUNT(*) as record_count FROM lv_zinergia_tarifas
UNION ALL
SELECT 'v_active_tariffs', COUNT(*) FROM v_active_tariffs
UNION ALL
SELECT 'v_tariff_stats', COUNT(*) FROM v_tariff_stats;

-- Sample tariffs
SELECT company, tariff_name, tariff_type, offer_type
FROM lv_zinergia_tarifas
WHERE is_active = TRUE
ORDER BY tariff_type, company
LIMIT 10;

-- =============================================
-- END OF SCRIPT
-- =============================================
