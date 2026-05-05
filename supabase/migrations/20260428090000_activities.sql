-- =============================================
-- CLIENT ACTIVITIES — Timeline por cliente
-- =============================================

CREATE TABLE IF NOT EXISTS client_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id),

    type TEXT NOT NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_client ON client_activities(client_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activities_agent ON client_activities(agent_id);
CREATE INDEX IF NOT EXISTS idx_activities_type ON client_activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_franchise ON client_activities(franchise_id);

ALTER TABLE client_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent sees own client activities"
    ON client_activities FOR SELECT
    USING (
        agent_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM clients c
            WHERE c.id = client_activities.client_id
            AND c.owner_id = auth.uid()
        )
    );

CREATE POLICY "Franchise sees franchise activities"
    ON client_activities FOR SELECT
    USING (
        franchise_id IN (
            SELECT franchise_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin sees all activities"
    ON client_activities FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Agent inserts own activities"
    ON client_activities FOR INSERT
    WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Franchise inserts activities"
    ON client_activities FOR INSERT
    WITH CHECK (
        franchise_id IN (
            SELECT franchise_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin inserts activities"
    ON client_activities FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Verificación
SELECT
    'client_activities' AS tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'client_activities'
ORDER BY ordinal_position;

SELECT
    'RLS' AS info,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'client_activities'
ORDER BY policyname;
