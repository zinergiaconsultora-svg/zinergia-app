-- ============================================================
-- Energy CRM: supply_points + switch_events tables
-- ============================================================

-- 1. supply_points — Multi-CUPS per client
CREATE TABLE IF NOT EXISTS supply_points (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    -- Legacy nullable plaintext column kept only for environments where an
    -- earlier draft of this migration may have run. New writes use ciphertext.
    cups text,
    cups_ciphertext text,
    cups_hash text,
    cups_last4 text,
    supply_type text NOT NULL DEFAULT 'electricity' CHECK (supply_type IN ('electricity', 'gas')),
    address text,
    city text,
    zip_code text,
    contracted_power jsonb,
    current_marketer text,
    current_tariff text,
    annual_consumption_kwh numeric,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE supply_points
    ADD COLUMN IF NOT EXISTS cups text,
    ADD COLUMN IF NOT EXISTS cups_ciphertext text,
    ADD COLUMN IF NOT EXISTS cups_hash text,
    ADD COLUMN IF NOT EXISTS cups_last4 text;

ALTER TABLE supply_points
    ALTER COLUMN cups DROP NOT NULL;

DROP INDEX IF EXISTS idx_supply_points_cups;
CREATE UNIQUE INDEX IF NOT EXISTS idx_supply_points_cups_hash ON supply_points(cups_hash) WHERE cups_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_supply_points_client ON supply_points(client_id);

ALTER TABLE supply_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view supply points in their franchise" ON supply_points;
CREATE POLICY "Users can view supply points in their franchise"
    ON supply_points FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients c
            JOIN profiles p ON p.id = auth.uid()
            WHERE c.id = supply_points.client_id
              AND (p.role = 'admin' OR c.franchise_id = p.franchise_id)
        )
    );

DROP POLICY IF EXISTS "Users can manage supply points in their franchise" ON supply_points;
CREATE POLICY "Users can manage supply points in their franchise"
    ON supply_points FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients c
            JOIN profiles p ON p.id = auth.uid()
            WHERE c.id = supply_points.client_id
              AND (p.role = 'admin' OR c.franchise_id = p.franchise_id)
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON supply_points TO authenticated;

-- 2. switch_events — Cambios de comercializadora
CREATE TABLE IF NOT EXISTS switch_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    supply_point_id uuid REFERENCES supply_points(id) ON DELETE SET NULL,
    -- Legacy nullable plaintext column kept only for compatibility. New writes
    -- should use supply_point_id or encrypted/hash columns.
    cups text,
    cups_ciphertext text,
    cups_hash text,
    cups_last4 text,
    switch_date date NOT NULL DEFAULT CURRENT_DATE,
    previous_marketer text,
    previous_tariff text,
    previous_annual_cost numeric,
    new_marketer text NOT NULL,
    new_tariff text,
    new_annual_cost numeric,
    annual_savings numeric,
    reason text CHECK (reason IN ('mejor_precio', 'mejor_servicio', 'fin_permanencia', 'insatisfaccion', 'nuevo_punto', 'recomendacion')),
    notes text,
    proposal_id uuid,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE switch_events
    ADD COLUMN IF NOT EXISTS cups text,
    ADD COLUMN IF NOT EXISTS cups_ciphertext text,
    ADD COLUMN IF NOT EXISTS cups_hash text,
    ADD COLUMN IF NOT EXISTS cups_last4 text;

CREATE INDEX IF NOT EXISTS idx_switch_events_client ON switch_events(client_id, switch_date DESC);
CREATE INDEX IF NOT EXISTS idx_switch_events_franchise ON switch_events(client_id);

ALTER TABLE switch_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view switch events in their franchise" ON switch_events;
CREATE POLICY "Users can view switch events in their franchise"
    ON switch_events FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients c
            JOIN profiles p ON p.id = auth.uid()
            WHERE c.id = switch_events.client_id
              AND (p.role = 'admin' OR c.franchise_id = p.franchise_id)
        )
    );

DROP POLICY IF EXISTS "Users can manage switch events in their franchise" ON switch_events;
CREATE POLICY "Users can manage switch events in their franchise"
    ON switch_events FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM clients c
            JOIN profiles p ON p.id = auth.uid()
            WHERE c.id = switch_events.client_id
              AND (p.role = 'admin' OR c.franchise_id = p.franchise_id)
        )
    );

GRANT SELECT, INSERT, UPDATE, DELETE ON switch_events TO authenticated;

-- 3. Trigger: updated_at on supply_points
CREATE OR REPLACE FUNCTION update_supply_points_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supply_points_updated_at ON supply_points;
CREATE TRIGGER trg_supply_points_updated_at
    BEFORE UPDATE ON supply_points
    FOR EACH ROW EXECUTE FUNCTION update_supply_points_updated_at();

-- 4. Auto-create switch_event when proposal is accepted
-- (Feature #4: Loop Contrato↔ATR↔Renovación)
CREATE OR REPLACE FUNCTION auto_log_switch_event()
RETURNS trigger AS $$
DECLARE
    v_client_id uuid;
    v_client_name text;
    v_previous_supplier text;
BEGIN
    -- Solo cuando una propuesta pasa a 'accepted'
    IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM NEW.status) THEN
        SELECT client_id INTO v_client_id FROM proposals WHERE id = NEW.id;
        IF v_client_id IS NULL THEN RETURN NEW; END IF;

        SELECT current_supplier INTO v_previous_supplier
        FROM clients WHERE id = v_client_id;

        INSERT INTO switch_events (client_id, switch_date, previous_marketer, new_marketer, annual_savings, proposal_id)
        VALUES (
            v_client_id,
            CURRENT_DATE,
            v_previous_supplier,
            COALESCE(NEW.closed_company, 'Nueva comercializadora'),
            COALESCE(NEW.annual_savings, 0),
            NEW.id
        )
        ON CONFLICT DO NOTHING;

        -- Actualizar current_supplier en el cliente
        UPDATE clients SET current_supplier = COALESCE(NEW.closed_company, current_supplier)
        WHERE id = v_client_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_switch_event ON proposals;
CREATE TRIGGER trg_auto_switch_event
    AFTER UPDATE OF status ON proposals
    FOR EACH ROW EXECUTE FUNCTION auto_log_switch_event();
