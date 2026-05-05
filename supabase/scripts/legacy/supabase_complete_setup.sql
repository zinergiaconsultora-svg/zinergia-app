-- =============================================
-- ZINERGIA - SUPABASE COMPLETE SETUP (NEW PROJECT)
-- =============================================
-- Orden de ejecución: Copiar y pegar TODO en SQL Editor
-- https://supabase.com/dashboard/project/gmjgkzaxmkaggsyczwcm/sql/new
-- =============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- TABLA BASE: PROFILES (Extensión de auth.users)
-- =============================================

-- Crear tabla profiles si no existe
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    phone TEXT,
    bio TEXT,
    timezone TEXT DEFAULT 'Europe/Madrid',
    role TEXT DEFAULT 'agent' CHECK (role IN ('admin', 'franchise', 'agent')),
    parent_id UUID REFERENCES profiles(id),
    franchise_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA BASE: FRANCHISES
-- =============================================

CREATE TABLE IF NOT EXISTS franchises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA BASE: CLIENTS
-- =============================================

CREATE TABLE IF NOT EXISTS clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    notes TEXT,
    lead_source TEXT,
    last_contact_date DATE,
    status TEXT DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'in_process', 'won', 'lost')),
    average_monthly_bill NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- TABLA BASE: PROPOSALS
-- =============================================

CREATE TABLE IF NOT EXISTS proposals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    sent_date DATE,
    accepted_date DATE,
    rejected_date DATE,
    rejection_reason TEXT,
    probability_score INTEGER DEFAULT 50,
    offer_snapshot JSONB NOT NULL,
    calculation_data JSONB NOT NULL,
    current_annual_cost NUMERIC NOT NULL,
    offer_annual_cost NUMERIC NOT NULL,
    annual_savings NUMERIC NOT NULL,
    savings_percent NUMERIC NOT NULL,
    optimization_result JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- NETWORK TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS franchise_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    franchise_id UUID NOT NULL REFERENCES profiles(id) UNIQUE,
    company_name TEXT,
    royalty_percent NUMERIC DEFAULT 10.0,
    entry_fee NUMERIC DEFAULT 0,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS network_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES profiles(id),
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('franchise', 'agent')),
    code TEXT UNIQUE NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE TABLE IF NOT EXISTS network_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id),
    franchise_id UUID REFERENCES profiles(id),
    agent_commission NUMERIC NOT NULL,
    franchise_commission NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_date DATE
);

CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
    points INTEGER DEFAULT 0,
    level TEXT DEFAULT 'bronze' CHECK (level IN ('bronze', 'silver', 'gold', 'platinum')),
    badges JSONB DEFAULT '[]'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- OFFERS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS offers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    franchise_id UUID REFERENCES franchises(id) ON DELETE CASCADE,
    marketer_name TEXT NOT NULL,
    tariff_name TEXT NOT NULL,
    description TEXT,
    contract_duration TEXT,
    logo_color TEXT,
    type TEXT DEFAULT 'fixed' CHECK (type IN ('fixed', 'indexed')),
    power_price JSONB DEFAULT '{}'::jsonb,
    energy_price JSONB DEFAULT '{}'::jsonb,
    fixed_fee NUMERIC DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================
-- TARIFAS TABLE (34 tarifas de luz)
-- =============================================

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

-- Insert 2.0TD tariffs (24)
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

-- =============================================
-- EXTRA TABLES
-- =============================================

CREATE TABLE IF NOT EXISTS commission_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id),
    franchise_id UUID REFERENCES profiles(id),
    commission_amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'rejected')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_date DATE,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id),
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    link TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS dashboard_preferences (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    widgets JSONB DEFAULT '[]'::jsonb,
    theme TEXT DEFAULT 'light',
    language TEXT DEFAULT 'es',
    date_format TEXT DEFAULT 'DD/MM/YYYY',
    currency TEXT DEFAULT 'EUR',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    email_alerts BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_tarifas_company ON lv_zinergia_tarifas(company);
CREATE INDEX IF NOT EXISTS idx_tarifas_type ON lv_zinergia_tarifas(tariff_type);
CREATE INDEX IF NOT EXISTS idx_tarifas_active ON lv_zinergia_tarifas(is_active);
CREATE INDEX IF NOT EXISTS idx_tarifas_offer_type ON lv_zinergia_tarifas(offer_type);

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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- =============================================
-- FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TRIGGERS
-- =============================================

DROP TRIGGER IF EXISTS update_lv_zinergia_tarifas_updated_at ON lv_zinergia_tarifas;
CREATE TRIGGER update_lv_zinergia_tarifas_updated_at
    BEFORE UPDATE ON lv_zinergia_tarifas
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clients_updated_at ON clients;
CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON clients FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_proposals_updated_at ON proposals;
CREATE TRIGGER update_proposals_updated_at
    BEFORE UPDATE ON proposals FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_points_updated_at ON user_points;
CREATE TRIGGER update_user_points_updated_at
    BEFORE UPDATE ON user_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_preferences_updated_at ON dashboard_preferences;
CREATE TRIGGER update_dashboard_preferences_updated_at
    BEFORE UPDATE ON dashboard_preferences FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =============================================
-- VIEWS
-- =============================================

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

CREATE OR REPLACE VIEW v_franchise_client_stats AS
SELECT f.id as franchise_id, f.full_name as company_name,
       COUNT(DISTINCT c.id) as total_clients,
       COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'won') as active_clients,
       COUNT(DISTINCT c.id) FILTER (WHERE c.status IN ('new', 'contacted', 'in_process')) as pending_clients,
       COUNT(DISTINCT c.id) FILTER (WHERE c.status = 'new') as new_clients,
       SUM(c.average_monthly_bill) FILTER (WHERE c.status = 'won') as total_monthly_revenue
FROM profiles f
LEFT JOIN clients c ON c.franchise_id = f.id
WHERE f.role = 'franchise' OR f.role = 'admin'
GROUP BY f.id, f.full_name
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

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchise_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE network_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE lv_zinergia_tarifas ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can see own profile" ON profiles;
CREATE POLICY "Users can see own profile" ON profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Franchises can see their agents" ON profiles;
CREATE POLICY "Franchises can see their agents" ON profiles
    FOR SELECT USING (
        auth.uid() = parent_id 
        OR id IN (SELECT parent_id FROM profiles WHERE id = auth.uid())
    );

DROP POLICY IF EXISTS "Admin sees all" ON profiles;
CREATE POLICY "Admin sees all" ON profiles
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- Franchises policies
DROP POLICY IF EXISTS "Public can view franchises" ON franchises;
CREATE POLICY "Public can view franchises" ON franchises
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage franchises" ON franchises;
CREATE POLICY "Admins can manage franchises" ON franchises
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Clients policies
DROP POLICY IF EXISTS "Users can see own clients" ON clients;
CREATE POLICY "Users can see own clients" ON clients
    FOR SELECT USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own clients" ON clients;
CREATE POLICY "Users can insert own clients" ON clients
    FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "Users can update own clients" ON clients;
CREATE POLICY "Users can update own clients" ON clients
    FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "Admins can see all clients" ON clients;
CREATE POLICY "Admins can see all clients" ON clients
    FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Proposals policies
DROP POLICY IF EXISTS "Users can see own proposals" ON proposals;
CREATE POLICY "Users can see own proposals" ON proposals
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM clients WHERE id = proposals.client_id AND owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can insert own proposals" ON proposals;
CREATE POLICY "Users can insert own proposals" ON proposals
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM clients WHERE id = proposals.client_id AND owner_id = auth.uid())
    );

DROP POLICY IF EXISTS "Users can update own proposals" ON proposals;
CREATE POLICY "Users can update own proposals" ON proposals
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM clients WHERE id = proposals.client_id AND owner_id = auth.uid())
    );

-- Network invitations policies
DROP POLICY IF EXISTS "Creators see own invitations" ON network_invitations;
CREATE POLICY "Creators see own invitations" ON network_invitations
    FOR SELECT USING (auth.uid() = creator_id);

-- Tarifas policies
DROP POLICY IF EXISTS "Authenticated users can view active tariffs" ON lv_zinergia_tarifas;
CREATE POLICY "Authenticated users can view active tariffs" ON lv_zinergia_tarifas
    FOR SELECT USING (auth.uid() IS NOT NULL AND is_active = TRUE);

-- Notifications policies
DROP POLICY IF EXISTS "Users can see own notifications" ON notifications;
CREATE POLICY "Users can see own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Dashboard preferences policies
DROP POLICY IF EXISTS "Users can manage own preferences" ON dashboard_preferences;
CREATE POLICY "Users can manage own preferences" ON dashboard_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Audit logs policies
DROP POLICY IF EXISTS "Admins can see all audit logs" ON audit_logs;
CREATE POLICY "Admins can see all audit logs" ON audit_logs
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Commission tracking policies
DROP POLICY IF EXISTS "Users can see own commissions" ON commission_tracking;
CREATE POLICY "Users can see own commissions" ON commission_tracking
    FOR SELECT USING (auth.uid() = agent_id OR auth.uid() = franchise_id);

DROP POLICY IF EXISTS "Admins can see all commissions" ON commission_tracking;
CREATE POLICY "Admins can see all commissions" ON commission_tracking
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Offers policies
DROP POLICY IF EXISTS "Users can view offers" ON offers;
CREATE POLICY "Users can view offers" ON offers
    FOR SELECT USING (
        franchise_id = (SELECT franchise_id FROM profiles WHERE id = auth.uid()) 
        OR franchise_id IS NULL
    );

DROP POLICY IF EXISTS "Users can manage offers" ON offers;
CREATE POLICY "Users can manage offers" ON offers
    FOR ALL USING (franchise_id = (SELECT franchise_id FROM profiles WHERE id = auth.uid()))
    WITH CHECK (franchise_id = (SELECT franchise_id FROM profiles WHERE id = auth.uid()));

-- =============================================
-- GRANTS
-- =============================================

GRANT SELECT ON v_active_tariffs TO authenticated;
GRANT SELECT ON v_tariff_stats TO authenticated;
GRANT SELECT ON v_franchise_client_stats TO authenticated;
GRANT SELECT ON v_proposal_funnel TO authenticated;

-- =============================================
-- SEED DATA
-- =============================================

-- Insert HQ Franchise
INSERT INTO franchises (slug, name)
VALUES ('hq', 'Zinergia Central')
ON CONFLICT (slug) DO NOTHING;

-- =============================================
-- VERIFICATION
-- =============================================

SELECT 'lv_zinergia_tarifas' as table_name, COUNT(*) as record_count FROM lv_zinergia_tarifas
UNION ALL
SELECT 'v_active_tariffs', COUNT(*) FROM v_active_tariffs
UNION ALL
SELECT 'franchises', COUNT(*) FROM franchises
UNION ALL
SELECT 'profiles', COUNT(*) FROM profiles;

-- =============================================
-- END OF SCRIPT
-- =============================================
