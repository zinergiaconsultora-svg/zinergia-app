-- =============================================
-- ZINERGIA SUPABASE MIGRATION v1.0
-- =============================================
-- Script de migración para actualizar bases de datos existentes
-- =============================================

-- 1. Add missing columns if they don't exist
ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS bio TEXT,
    ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Europe/Madrid';

ALTER TABLE clients
    ADD COLUMN IF NOT EXISTS phone TEXT,
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS lead_source TEXT,
    ADD COLUMN IF NOT EXISTS last_contact_date DATE;

ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS sent_date DATE,
    ADD COLUMN IF NOT EXISTS accepted_date DATE,
    ADD COLUMN IF NOT EXISTS rejected_date DATE,
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
    ADD COLUMN IF NOT EXISTS probability_score INTEGER DEFAULT 50;

-- 2. Create commission tracking table if not exists (redundancy check)
CREATE TABLE IF NOT EXISTS commission_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id),
    franchise_id UUID REFERENCES profiles(id),
    commission_amount NUMERIC NOT NULL,
    status TEXT CHECK (status IN ('pending', 'approved', 'paid', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    paid_date DATE,
    notes TEXT
);

ALTER TABLE commission_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own commissions" ON commission_tracking
    FOR SELECT USING (auth.uid() = agent_id OR auth.uid() = franchise_id);

CREATE POLICY "Admins can see all commissions" ON commission_tracking
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 3. Create audit log table
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

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can see all audit logs" ON audit_logs
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 4. Create notification system tables
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('info', 'success', 'warning', 'error')) DEFAULT 'info',
    link TEXT,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 5. Create dashboard preferences table
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

ALTER TABLE dashboard_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences" ON dashboard_preferences
    FOR ALL USING (auth.uid() = user_id);

-- 6. Add foreign key constraints if missing
DO $$ 
BEGIN
    -- Add foreign key for clients.franchise_id if constraint doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'clients_franchise_id_fkey'
    ) THEN
        ALTER TABLE clients 
        ADD CONSTRAINT clients_franchise_id_fkey 
        FOREIGN KEY (franchise_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
    
    -- Add foreign key for proposals.franchise_id if constraint doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'proposals_franchise_id_fkey'
    ) THEN
        ALTER TABLE proposals 
        ADD CONSTRAINT proposals_franchise_id_fkey 
        FOREIGN KEY (franchise_id) REFERENCES profiles(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 7. Create helpful views for analytics
CREATE OR REPLACE VIEW v_recent_activity AS
SELECT 
    p.id as user_id,
    p.full_name,
    p.role,
    'client_created' as activity_type,
    c.id as record_id,
    c.name as record_name,
    c.created_at as activity_date
FROM profiles p
JOIN clients c ON c.owner_id = p.id
WHERE c.created_at >= NOW() - INTERVAL '30 days'

UNION ALL

SELECT 
    p.id,
    p.full_name,
    p.role,
    'proposal_created',
    prop.id,
    prop.offer_snapshot->>'tariff_name',
    prop.created_at
FROM profiles p
JOIN clients c ON c.owner_id = p.id
JOIN proposals prop ON prop.client_id = c.id
WHERE prop.created_at >= NOW() - INTERVAL '30 days'

UNION ALL

SELECT 
    p.id,
    p.full_name,
    p.role,
    'commission_earned',
    nc.id,
    nc.proposal_id::TEXT,
    nc.created_at
FROM profiles p
JOIN network_commissions nc ON nc.agent_id = p.id
WHERE nc.created_at >= NOW() - INTERVAL '30 days'

ORDER BY activity_date DESC;

-- 8. Create view for pipeline analysis
CREATE OR REPLACE VIEW v_pipeline_analysis AS
WITH date_range AS (
    SELECT 
        date_trunc('month', CURRENT_DATE) as month_start,
        date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day' as month_end
),
monthly_stats AS (
    SELECT 
        p.status,
        COUNT(*) as count,
        SUM(p.annual_savings) as total_savings,
        AVG(p.annual_savings) as avg_savings,
        COUNT(DISTINCT p.franchise_id) as franchises_count
    FROM proposals p
    WHERE p.created_at >= (SELECT month_start FROM date_range)
        AND p.created_at <= (SELECT month_end FROM date_range)
    GROUP BY p.status
)
SELECT 
    'New' as stage,
    COALESCE(count, 0) as count,
    COALESCE(total_savings, 0) as total_savings,
    COALESCE(avg_savings, 0) as avg_savings,
    0 as conversion_rate
FROM monthly_stats WHERE status = 'draft'

UNION ALL

SELECT 
    'Sent' as stage,
    COALESCE(count, 0) as count,
    COALESCE(total_savings, 0) as total_savings,
    COALESCE(avg_savings, 0) as avg_savings,
    0 as conversion_rate
FROM monthly_stats WHERE status = 'sent'

UNION ALL

SELECT 
    'Accepted' as stage,
    COALESCE(count, 0) as count,
    COALESCE(total_savings, 0) as total_savings,
    COALESCE(avg_savings, 0) as avg_savings,
    CASE 
        WHEN (SELECT SUM(count) FROM monthly_stats) > 0 
        THEN ROUND((count::NUMERIC / (SELECT SUM(count) FROM monthly_stats)) * 100, 2)
        ELSE 0 
    END as conversion_rate
FROM monthly_stats WHERE status = 'accepted';

-- 9. Add helpful functions
CREATE OR REPLACE FUNCTION get_user_notifications(user_uuid UUID, unread_only BOOLEAN DEFAULT FALSE)
RETURNS TABLE (
    id UUID,
    title TEXT,
    message TEXT,
    type TEXT,
    link TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        n.id,
        n.title,
        n.message,
        n.type,
        n.link,
        n.created_at
    FROM notifications n
    WHERE n.user_id = user_uuid
        AND (n.expires_at IS NULL OR n.expires_at >= NOW())
        AND (NOT unread_only OR n.read = FALSE)
    ORDER BY n.created_at DESC
    LIMIT 50;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mark_notification_read(notification_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE notifications
    SET read = TRUE
    WHERE id = notification_uuid AND user_id = user_uuid;
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_notification(
    user_uuid UUID,
    notification_title TEXT,
    notification_message TEXT,
    notification_type TEXT DEFAULT 'info',
    notification_link TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    new_notification_id UUID;
BEGIN
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (user_uuid, notification_title, notification_message, notification_type, notification_link)
    RETURNING id INTO new_notification_id;
    
    RETURN new_notification_id;
END;
$$ LANGUAGE plpgsql;

-- 10. Create function to calculate client health score
CREATE OR REPLACE FUNCTION calculate_client_health(client_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    health_score INTEGER := 100;
    days_since_last_contact INTEGER;
    total_proposals INTEGER;
    accepted_proposals INTEGER;
BEGIN
    -- Deduct points if no recent contact
    SELECT EXTRACT(DAY FROM (CURRENT_DATE - c.last_contact_date))::INTEGER
    INTO days_since_last_contact
    FROM clients c
    WHERE c.id = client_uuid;
    
    IF days_since_last_contact > 30 THEN
        health_score := health_score - 20;
    ELSIF days_since_last_contact > 14 THEN
        health_score := health_score - 10;
    END IF;
    
    -- Add points for proposals
    SELECT COUNT(*), COUNT(*) FILTER (WHERE status = 'accepted')
    INTO total_proposals, accepted_proposals
    FROM proposals
    WHERE client_id = client_uuid;
    
    health_score := health_score + (total_proposals * 5) + (accepted_proposals * 15);
    
    -- Ensure score is between 0 and 100
    health_score := GREATEST(0, LEAST(100, health_score));
    
    RETURN health_score;
END;
$$ LANGUAGE plpgsql;

-- 11. Add updated_at trigger for new tables
DROP TRIGGER IF EXISTS update_dashboard_preferences_updated_at ON dashboard_preferences;
CREATE TRIGGER update_dashboard_preferences_updated_at
    BEFORE UPDATE ON dashboard_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 12. Grant permissions on new tables and views
GRANT SELECT ON v_recent_activity TO authenticated;
GRANT SELECT ON v_pipeline_analysis TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_client_health TO authenticated;

-- 13. Add comments
COMMENT ON TABLE commission_tracking IS 'Seguimiento detallado de comisiones por propuesta';
COMMENT ON TABLE audit_logs IS 'Registro de auditoría de cambios en la base de datos';
COMMENT ON TABLE notifications IS 'Sistema de notificaciones para usuarios';
COMMENT ON TABLE dashboard_preferences IS 'Preferencias personalizadas del dashboard por usuario';
COMMENT ON VIEW v_recent_activity IS 'Actividad reciente de todo el sistema';
COMMENT ON VIEW v_pipeline_analysis IS 'Análisis del pipeline de ventas del mes actual';

-- 14. Create summary function
CREATE OR REPLACE FUNCTION get_migration_summary()
RETURNS TABLE (
    table_name TEXT,
    record_count BIGINT,
    description TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        'lv_zinergia_tarifas'::TEXT,
        COUNT(*)::BIGINT,
        'Tarifas eléctricas maestras'::TEXT
    FROM lv_zinergia_tarifas
    
    UNION ALL
    
    SELECT 
        'commission_tracking',
        COUNT(*)::BIGINT,
        'Seguimiento de comisiones'
    FROM commission_tracking
    
    UNION ALL
    
    SELECT 
        'audit_logs',
        COUNT(*)::BIGINT,
        'Logs de auditoría'
    FROM audit_logs
    
    UNION ALL
    
    SELECT 
        'notifications',
        COUNT(*)::BIGINT,
        'Notificaciones de usuario'
    FROM notifications
    
    UNION ALL
    
    SELECT 
        'dashboard_preferences',
        COUNT(*)::BIGINT,
        'Preferencias del dashboard'
    FROM dashboard_preferences;
END;
$$ LANGUAGE plpgsql;

-- Execute summary to show results
SELECT * FROM get_migration_summary();

-- =============================================
-- END OF MIGRATION SCRIPT
-- =============================================
