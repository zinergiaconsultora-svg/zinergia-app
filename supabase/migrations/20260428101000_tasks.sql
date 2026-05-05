-- =============================================
-- TASKS — Gestión de tareas con auto-generación
-- =============================================

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID REFERENCES clients(id) ON DELETE CASCADE,
    proposal_id UUID REFERENCES proposals(id) ON DELETE SET NULL,
    agent_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES franchises(id),

    title TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL DEFAULT 'manual' CHECK (type IN ('manual', 'follow_up', 'documentation', 'contract_signature', 'welcome_call')),
    priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),

    due_date DATE,
    completed_at TIMESTAMPTZ,
    auto_generated BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_agent ON tasks(agent_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_client ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_franchise ON tasks(franchise_id);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent sees own tasks"
    ON tasks FOR SELECT
    USING (agent_id = auth.uid());

CREATE POLICY "Agent manages own tasks"
    ON tasks FOR ALL
    USING (agent_id = auth.uid());

CREATE POLICY "Franchise sees franchise tasks"
    ON tasks FOR SELECT
    USING (
        franchise_id IN (
            SELECT franchise_id FROM profiles WHERE id = auth.uid()
        )
    );

CREATE POLICY "Admin sees all tasks"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admin manages all tasks"
    ON tasks FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
        )
    );

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verificación
SELECT
    'tasks' AS tabla,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'tasks'
ORDER BY ordinal_position;

SELECT
    'RLS' AS info,
    policyname,
    permissive,
    cmd
FROM pg_policies
WHERE tablename = 'tasks'
ORDER BY policyname;
