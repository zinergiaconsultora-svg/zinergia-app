-- =============================================
-- ZINERGIA SUPABASE COMPLETE REVIEW
-- =============================================
-- Revisión y optimización completa de la base de datos
-- =============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";  -- Para análisis de rendimiento

-- =============================================
-- 1. FIXES AND IMPROVEMENTS
-- =============================================

-- Fix: Ensure all tables have proper updated_at triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at to tables that don't have it
ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE clients 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE proposals 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
CREATE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON proposals
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- 2. PERFORMANCE INDEXES
-- =============================================

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_franchise_id ON clients(franchise_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
CREATE INDEX IF NOT EXISTS idx_clients_type ON clients(type);
CREATE INDEX IF NOT EXISTS idx_clients_created_at ON clients(created_at DESC);

-- Proposals table indexes
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_franchise_id ON proposals(franchise_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_annual_savings ON proposals(annual_savings DESC);

-- Network invitations indexes
CREATE INDEX IF NOT EXISTS idx_invitations_creator_id ON network_invitations(creator_id);
CREATE INDEX IF NOT EXISTS idx_invitations_code ON network_invitations(code);
CREATE INDEX IF NOT EXISTS idx_invitations_expires_at ON network_invitations(expires_at);

-- Commissions indexes
CREATE INDEX IF NOT EXISTS idx_commissions_proposal_id ON network_commissions(proposal_id);
CREATE INDEX IF NOT EXISTS idx_commissions_agent_id ON network_commissions(agent_id);
CREATE INDEX IF NOT EXISTS idx_commissions_franchise_id ON network_commissions(franchise_id);
CREATE INDEX IF NOT EXISTS idx_commissions_status ON network_commissions(status);

-- User points indexes
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_points ON user_points(points DESC);

-- =============================================
-- 3. VIEWS FOR DASHBOARD AND ANALYTICS
-- =============================================

-- View: Client statistics by franchise
CREATE OR REPLACE VIEW v_franchise_client_stats AS
SELECT 
    f.id as franchise_id,
    f.company_name,
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

-- View: Proposal funnel
CREATE OR REPLACE VIEW v_proposal_funnel AS
SELECT 
    p.status,
    COUNT(*) as count,
    SUM(p.annual_savings) as total_savings,
    AVG(p.annual_savings) as avg_savings,
    COUNT(DISTINCT p.franchise_id) as franchises_involved
FROM proposals p
WHERE p.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.status
ORDER BY 
    CASE p.status
        WHEN 'draft' THEN 1
        WHEN 'sent' THEN 2
        WHEN 'accepted' THEN 3
        WHEN 'rejected' THEN 4
        WHEN 'expired' THEN 5
    END;

-- View: Top performers (agents and franchises)
CREATE OR REPLACE VIEW v_top_performers AS
SELECT 
    p.id as user_id,
    p.full_name,
    p.role,
    COUNT(DISTINCT prop.id) FILTER (WHERE prop.status = 'accepted') as closed_deals,
    SUM(prop.annual_savings) FILTER (WHERE prop.status = 'accepted') as total_savings_generated,
    SUM(nc.agent_commission) FILTER (WHERE nc.status = 'paid') as total_earned,
    up.points,
    up.badges
FROM profiles p
LEFT JOIN proposals prop ON prop.client_id IN (SELECT id FROM clients WHERE owner_id = p.id)
LEFT JOIN network_commissions nc ON nc.agent_id = p.id
LEFT JOIN user_points up ON up.user_id = p.id
GROUP BY p.id, p.full_name, p.role, up.points, up.badges
ORDER BY closed_deals DESC, total_savings_generated DESC
LIMIT 20;

-- View: Active tariffs summary
CREATE OR REPLACE VIEW v_tariffs_summary AS
SELECT 
    company,
    tariff_type,
    offer_type,
    COUNT(*) as total_tariffs,
    STRING_AGG(tariff_name, ', ' ORDER BY tariff_name) as available_tariffs,
    MIN(power_price_p1) as min_power_p1,
    MAX(power_price_p1) as max_power_p1,
    AVG(power_price_p1) as avg_power_p1
FROM lv_zinergia_tarifas
WHERE is_active = TRUE
GROUP BY company, tariff_type, offer_type
ORDER BY company, tariff_type;

-- =============================================
-- 4. HELPER FUNCTIONS
-- =============================================

-- Function: Get client with latest proposal
CREATE OR REPLACE FUNCTION get_client_with_latest_proposal(client_uuid UUID)
RETURNS TABLE (
    client_id UUID,
    client_name TEXT,
    status TEXT,
    latest_proposal_id UUID,
    latest_proposal_status TEXT,
    latest_annual_savings NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id,
        c.name,
        c.status,
        p.id as latest_proposal_id,
        p.status as latest_proposal_status,
        p.annual_savings as latest_annual_savings
    FROM clients c
    LEFT JOIN LATERAL (
        SELECT id, status, annual_savings
        FROM proposals
        WHERE client_id = c.id
        ORDER BY created_at DESC
        LIMIT 1
    ) p ON true
    WHERE c.id = client_uuid;
END;
$$ LANGUAGE plpgsql;

-- Function: Calculate franchise monthly revenue
CREATE OR REPLACE FUNCTION calculate_franchise_revenue(franchise_uuid UUID)
RETURNS TABLE (
    month_start DATE,
    month_end DATE,
    active_clients INT,
    estimated_revenue NUMERIC,
    commissions_paid NUMERIC,
    net_revenue NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH date_range AS (
        SELECT 
            date_trunc('month', CURRENT_DATE) as month_start,
            date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day' as month_end
    ),
    client_stats AS (
        SELECT 
            COUNT(*) FILTER (WHERE status = 'won') as active_count,
            COALESCE(SUM(average_monthly_bill) FILTER (WHERE status = 'won'), 0) as monthly_bill_total
        FROM clients
        WHERE franchise_id = franchise_uuid
    ),
    commission_stats AS (
        SELECT 
            COALESCE(SUM(agent_commission), 0) as total_paid
        FROM network_commissions
        WHERE franchise_id = franchise_uuid
            AND status = 'paid'
            AND created_at >= (SELECT month_start FROM date_range)
            AND created_at <= (SELECT month_end FROM date_range)
    )
    SELECT 
        dr.month_start::DATE,
        dr.month_end::DATE,
        cs.active_count,
        cs.monthly_bill_total,
        cm.total_paid,
        cs.monthly_bill_total - cm.total_paid
    FROM date_range dr
    CROSS JOIN client_stats cs
    CROSS JOIN commission_stats cm;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 5. DATA INTEGRITY CHECKS
-- =============================================

-- Function: Check for orphaned records
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE (
    table_name TEXT,
    issue_type TEXT,
    count BIGINT
) AS $$
BEGIN
    -- Check for clients without valid franchise
    RETURN QUERY
    SELECT 
        'clients'::TEXT,
        'orphaned_franchise'::TEXT,
        COUNT(*)
    FROM clients c
    LEFT JOIN franchises f ON c.franchise_id = f.id
    WHERE c.franchise_id IS NOT NULL AND f.id IS NULL;
    
    -- Check for proposals without valid client
    RETURN QUERY
    SELECT 
        'proposals'::TEXT,
        'orphaned_client'::TEXT,
        COUNT(*)
    FROM proposals p
    LEFT JOIN clients c ON p.client_id = c.id
    WHERE p.client_id IS NOT NULL AND c.id IS NULL;
    
    -- Check for proposals without valid franchise
    RETURN QUERY
    SELECT 
        'proposals'::TEXT,
        'orphaned_franchise'::TEXT,
        COUNT(*)
    FROM proposals p
    LEFT JOIN franchises f ON p.franchise_id = f.id
    WHERE p.franchise_id IS NOT NULL AND f.id IS NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 6. SECURITY AND POLICY UPDATES
-- =============================================

-- Ensure RLS is enabled on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_config ENABLE ROW LEVEL SECURITY;

-- Create policy for franchise_config viewing
DROP POLICY IF EXISTS "Franchises can see own config" ON franchise_config;
CREATE POLICY "Franchises can see own config"
    ON franchise_config
    FOR SELECT
    USING (franchise_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Create policy for network_invitations management
DROP POLICY IF EXISTS "Creators can manage invitations" ON network_invitations;
CREATE POLICY "Creators can manage invitations"
    ON network_invitations
    FOR ALL
    USING (creator_id = auth.uid());

-- =============================================
-- 7. PERFORMANCE ANALYSIS FUNCTIONS
-- =============================================

-- Function: Identify slow queries (requires pg_stat_statements)
CREATE OR REPLACE FUNCTION get_slow_queries(min_exec_time INT DEFAULT 1000)
RETURNS TABLE (
    query TEXT,
    calls BIGINT,
    total_time NUMERIC,
    mean_time NUMERIC,
    stddev_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        LEFT(query, 200) as query,
        calls,
        total_exec_time as total_time,
        mean_exec_time as mean_time,
        stddev_exec_time as stddev_time
    FROM pg_stat_statements
    WHERE mean_exec_time > min_exec_time
    ORDER BY mean_exec_time DESC
    LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 8. MAINTENANCE FUNCTIONS
-- =============================================

-- Function: Clean up expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM network_invitations
    WHERE expires_at < NOW() - INTERVAL '30 days' AND used = FALSE;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Update user activity scores
CREATE OR REPLACE FUNCTION update_activity_scores()
RETURNS INT AS $$
DECLARE
    updated_count INT;
BEGIN
    -- Update points based on recent activity
    UPDATE user_points up
    SET points = points + 
        -- Points for proposals created in last 30 days
        (SELECT COUNT(*) * 10 FROM proposals p 
         WHERE p.client_id IN (SELECT id FROM clients WHERE owner_id = up.user_id)
         AND p.created_at >= NOW() - INTERVAL '30 days') +
        -- Points for won deals
        (SELECT COUNT(*) * 50 FROM proposals p 
         WHERE p.client_id IN (SELECT id FROM clients WHERE owner_id = up.user_id)
         AND p.status = 'accepted'
         AND p.created_at >= NOW() - INTERVAL '30 days'),
        last_updated = NOW()
    WHERE up.user_id IN (
        SELECT DISTINCT owner_id FROM clients 
        WHERE updated_at >= NOW() - INTERVAL '30 days'
    );
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 9. COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE profiles IS 'Perfiles de usuarios (admin, franquicias, agentes) con jerarquía de red';
COMMENT ON TABLE clients IS 'Clientes de energía con propietario y franquicia';
COMMENT ON TABLE proposals IS 'Propuestas de ahorro enviadas a clientes';
COMMENT ON TABLE offers IS 'Ofertas de energía personalizadas por franquicia';
COMMENT ON TABLE network_invitations IS 'Invitaciones para unirse a la red de franquicias';
COMMENT ON TABLE network_commissions IS 'Comisiones generadas por propuestas aceptadas';
COMMENT ON TABLE user_points IS 'Puntos y badges de gamificación por usuario';
COMMENT ON TABLE franchise_config IS 'Configuración de franquicias (royalties, nombre empresa)';
COMMENT ON TABLE lv_zinergia_tarifas IS 'Tabla maestra de tarifas eléctricas 2.0TD, 3.0TD, 3.1TD';

-- =============================================
-- 10. GRANT PERMISSIONS
-- =============================================

-- Grant usage on schemas
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant select on views
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant execute on functions
GRANT EXECUTE ON FUNCTION get_client_with_latest_proposal TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_franchise_revenue TO authenticated;
GRANT EXECUTE ON FUNCTION check_data_integrity TO authenticated;
GRANT EXECUTE ON FUNCTION get_slow_queries TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations TO authenticated;
GRANT EXECUTE ON FUNCTION update_activity_scores TO authenticated;

-- =============================================
-- END OF SCRIPT
-- =============================================
