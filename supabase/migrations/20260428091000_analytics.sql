-- =============================================
-- ANALYTICS — Transiciones de estado + métricas
-- =============================================

CREATE TABLE IF NOT EXISTS client_status_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id),

    from_status TEXT,
    to_status TEXT NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transitions_agent ON client_status_transitions(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transitions_franchise ON client_status_transitions(franchise_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transitions_client ON client_status_transitions(client_id);

ALTER TABLE client_status_transitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent sees own transitions"
    ON client_status_transitions FOR SELECT
    USING (agent_id = auth.uid());

CREATE POLICY "Franchise sees franchise transitions"
    ON client_status_transitions FOR SELECT
    USING (
        franchise_id IN (
            SELECT franchise_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin sees all transitions"
    ON client_status_transitions FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "System inserts transitions"
    ON client_status_transitions FOR INSERT
    WITH CHECK (agent_id = auth.uid());

-- Trigger para auto-registrar transiciones de estado de clientes
CREATE OR REPLACE FUNCTION log_client_status_transition()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO client_status_transitions (client_id, agent_id, franchise_id, from_status, to_status)
        VALUES (
            NEW.id,
            COALESCE(NEW.owner_id, auth.uid()),
            NEW.franchise_id,
            OLD.status,
            NEW.status
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS clients_status_transition ON clients;
CREATE TRIGGER clients_status_transition
    AFTER UPDATE OF status ON clients
    FOR EACH ROW
    EXECUTE FUNCTION log_client_status_transition();

-- RPC: Funnel de conversión por agente
CREATE OR REPLACE FUNCTION get_conversion_funnel(p_agent_id UUID DEFAULT NULL)
RETURNS TABLE (
    status TEXT,
    count BIGINT,
    percentage NUMERIC
) AS $$
DECLARE
    total BIGINT;
    v_franchise_id UUID;
BEGIN
    IF p_agent_id IS NULL THEN
        SELECT franchise_id INTO v_franchise_id
        FROM profiles WHERE id = auth.uid();
    END IF;

    CREATE TEMP TABLE _funnel_counts AS
    SELECT status, COUNT(*) as cnt
    FROM clients
    WHERE (p_agent_id IS NULL AND franchise_id = v_franchise_id)
       OR owner_id = p_agent_id
    GROUP BY status;

    SELECT SUM(cnt) INTO total FROM _funnel_counts;

    RETURN QUERY
    SELECT
        fc.status,
        fc.cnt,
        CASE WHEN total > 0 THEN ROUND((fc.cnt::NUMERIC / total) * 100, 1) ELSE 0 END
    FROM _funnel_counts fc
    ORDER BY ARRAY_POSITION(ARRAY['new','contacted','in_process','won','lost'], fc.status);

    DROP TABLE _funnel_counts;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Métricas mensuales
CREATE OR REPLACE FUNCTION get_monthly_metrics(p_months INTEGER DEFAULT 6)
RETURNS TABLE (
    month TEXT,
    new_clients BIGINT,
    won_clients BIGINT,
    lost_clients BIGINT,
    proposals_sent BIGINT,
    proposals_accepted BIGINT,
    total_savings NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH months AS (
        SELECT to_char(d, 'YYYY-MM') as m
        FROM generate_series(
            DATE_TRUNC('month', CURRENT_DATE - (p_months - 1) * INTERVAL '1 month'),
            DATE_TRUNC('month', CURRENT_DATE),
            INTERVAL '1 month'
        ) d
    )
    SELECT
        months.m,
        COALESCE((SELECT COUNT(*) FROM clients WHERE to_char(created_at, 'YYYY-MM') = months.m AND owner_id = auth.uid()), 0),
        COALESCE((SELECT COUNT(*) FROM client_status_transitions WHERE to_status = 'won' AND to_char(created_at, 'YYYY-MM') = months.m AND agent_id = auth.uid()), 0),
        COALESCE((SELECT COUNT(*) FROM client_status_transitions WHERE to_status = 'lost' AND to_char(created_at, 'YYYY-MM') = months.m AND agent_id = auth.uid()), 0),
        COALESCE((SELECT COUNT(*) FROM client_activities WHERE type = 'proposal_sent' AND to_char(created_at, 'YYYY-MM') = months.m AND agent_id = auth.uid()), 0),
        COALESCE((SELECT COUNT(*) FROM client_activities WHERE type = 'proposal_accepted' AND to_char(created_at, 'YYYY-MM') = months.m AND agent_id = auth.uid()), 0),
        COALESCE((SELECT SUM(annual_savings) FROM proposals WHERE to_char(created_at, 'YYYY-MM') = months.m AND agent_id = auth.uid() AND status = 'accepted'), 0)
    FROM months
    ORDER BY months.m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verificación
SELECT
    'client_status_transitions' AS tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'client_status_transitions'
ORDER BY ordinal_position;

SELECT
    'RLS' AS info,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'client_status_transitions'
ORDER BY policyname;
