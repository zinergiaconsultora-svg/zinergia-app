-- Migration: Capture Studio + Renewal Autopilot + Sales Copilot
-- Covers all 3 features in a single migration to keep schema changes atomic.

-- ============================================================================
-- 1. CAPTURE STUDIO: file content hash for deduplication
-- ============================================================================

ALTER TABLE ocr_jobs
  ADD COLUMN IF NOT EXISTS file_content_hash text,
  ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES ocr_jobs(id);

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_file_content_hash
  ON ocr_jobs (franchise_id, file_content_hash)
  WHERE file_content_hash IS NOT NULL;

-- ============================================================================
-- 2. RENEWAL AUTOPILOT: renewal_opportunities table
-- ============================================================================

CREATE TABLE IF NOT EXISTS renewal_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  franchise_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  original_proposal_id uuid REFERENCES proposals(id) ON DELETE SET NULL,

  current_annual_cost numeric NOT NULL DEFAULT 0,
  best_new_annual_cost numeric NOT NULL DEFAULT 0,
  potential_savings numeric NOT NULL DEFAULT 0,
  savings_percent numeric NOT NULL DEFAULT 0,

  best_tariff_id uuid,
  best_tariff_name text,
  best_marketer text,

  priority_score numeric NOT NULL DEFAULT 0,
  reason text NOT NULL DEFAULT 'better_tariff',

  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'contacted', 'proposal_sent', 'converted', 'dismissed')),

  detected_at timestamptz NOT NULL DEFAULT now(),
  contacted_at timestamptz,
  expires_at timestamptz,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_renewal_opp_agent
  ON renewal_opportunities (agent_id, status, priority_score DESC);

CREATE INDEX IF NOT EXISTS idx_renewal_opp_franchise
  ON renewal_opportunities (franchise_id, status);

CREATE INDEX IF NOT EXISTS idx_renewal_opp_client
  ON renewal_opportunities (client_id);

ALTER TABLE renewal_opportunities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents see own renewal opportunities"
  ON renewal_opportunities FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Franchise sees franchise renewals"
  ON renewal_opportunities FOR SELECT
  USING (franchise_id IN (
    SELECT franchise_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Service role full access on renewals"
  ON renewal_opportunities FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. SALES COPILOT: next_actions table
-- ============================================================================

CREATE TABLE IF NOT EXISTS next_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL,
  franchise_id uuid NOT NULL,

  client_id uuid REFERENCES clients(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES proposals(id) ON DELETE CASCADE,

  action_type text NOT NULL
    CHECK (action_type IN (
      'call_new_lead', 'resend_proposal', 'call_interested',
      'prepare_renewal', 'follow_up_3d', 'follow_up_7d',
      'follow_up_14d', 'welcome_call', 'review_stale'
    )),

  priority text NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('critical', 'high', 'medium', 'low')),

  title text NOT NULL,
  description text,
  reason text,

  due_date date,
  completed_at timestamptz,

  metadata jsonb DEFAULT '{}',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_next_actions_agent
  ON next_actions (agent_id, completed_at, priority, due_date);

CREATE INDEX IF NOT EXISTS idx_next_actions_franchise
  ON next_actions (franchise_id, completed_at);

ALTER TABLE next_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents see own actions"
  ON next_actions FOR SELECT
  USING (agent_id = auth.uid());

CREATE POLICY "Agents update own actions"
  ON next_actions FOR UPDATE
  USING (agent_id = auth.uid());

CREATE POLICY "Franchise sees franchise actions"
  ON next_actions FOR SELECT
  USING (franchise_id IN (
    SELECT franchise_id FROM profiles WHERE id = auth.uid()
  ));

CREATE POLICY "Service role full access on actions"
  ON next_actions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 4. COMMISSION FORECAST: add probability fields to proposals
-- ============================================================================

ALTER TABLE proposals
  ADD COLUMN IF NOT EXISTS close_probability numeric DEFAULT 0
    CHECK (close_probability >= 0 AND close_probability <= 100);

-- Updated_at triggers for new tables
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_renewal_opp_updated_at') THEN
    CREATE TRIGGER trg_renewal_opp_updated_at
      BEFORE UPDATE ON renewal_opportunities
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_next_actions_updated_at') THEN
    CREATE TRIGGER trg_next_actions_updated_at
      BEFORE UPDATE ON next_actions
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END;
$$;
