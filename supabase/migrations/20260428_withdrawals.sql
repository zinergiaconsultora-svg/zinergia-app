-- ============================================================
-- Withdrawal Requests + IBAN on profiles
-- Enables agents/franchise to request commission payouts
-- ============================================================

-- 1. Add IBAN to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS iban text;

-- 2. Create withdrawal_requests table
CREATE TABLE IF NOT EXISTS withdrawal_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    amount numeric(12,2) NOT NULL CHECK (amount > 0),
    status text NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'paid')),
    iban text NOT NULL,
    commission_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
    rejection_reason text,
    reviewed_by uuid REFERENCES profiles(id),
    reviewed_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user ON withdrawal_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status ON withdrawal_requests(status);

-- 4. RLS
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own withdrawals"
    ON withdrawal_requests FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "Agents can insert own withdrawals"
    ON withdrawal_requests FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all withdrawals"
    ON withdrawal_requests FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'franchise')
        )
    );

CREATE POLICY "Admins can update withdrawals"
    ON withdrawal_requests FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE id = auth.uid() AND role IN ('admin', 'franchise')
        )
    );

-- 5. Updated_at trigger
CREATE OR REPLACE FUNCTION update_withdrawal_requests_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_withdrawal_requests_updated_at
    BEFORE UPDATE ON withdrawal_requests
    FOR EACH ROW EXECUTE FUNCTION update_withdrawal_requests_updated_at();

-- 6. RPC: Get withdrawal stats for a user (growth calculation)
CREATE OR REPLACE FUNCTION get_withdrawal_growth(p_user_id uuid)
RETURNS TABLE (
    current_month_earned numeric,
    previous_month_earned numeric,
    growth_percent numeric
) AS $$
DECLARE
    v_role text;
BEGIN
    SELECT role INTO v_role FROM profiles WHERE id = p_user_id;

    IF v_role = 'agent' THEN
        RETURN QUERY
        SELECT
            COALESCE(SUM(CASE
                WHEN nc.created_at >= date_trunc('month', now())
                THEN nc.agent_commission ELSE 0
            END), 0)::numeric,
            COALESCE(SUM(CASE
                WHEN nc.created_at >= date_trunc('month', now()) - interval '1 month'
                 AND nc.created_at < date_trunc('month', now())
                THEN nc.agent_commission ELSE 0
            END), 0)::numeric,
            CASE
                WHEN COALESCE(SUM(CASE
                    WHEN nc.created_at >= date_trunc('month', now()) - interval '1 month'
                     AND nc.created_at < date_trunc('month', now())
                    THEN nc.agent_commission ELSE 0
                END), 0) = 0 THEN 0
                ELSE ROUND((
                    COALESCE(SUM(CASE
                        WHEN nc.created_at >= date_trunc('month', now())
                        THEN nc.agent_commission ELSE 0
                    END), 0)::numeric
                    - COALESCE(SUM(CASE
                        WHEN nc.created_at >= date_trunc('month', now()) - interval '1 month'
                         AND nc.created_at < date_trunc('month', now())
                        THEN nc.agent_commission ELSE 0
                    END), 0)::numeric
                ) / GREATEST(COALESCE(SUM(CASE
                    WHEN nc.created_at >= date_trunc('month', now()) - interval '1 month'
                     AND nc.created_at < date_trunc('month', now())
                    THEN nc.agent_commission ELSE 0
                END), 0), 1)::numeric * 100, 1)
            END::numeric
        FROM network_commissions nc
        WHERE nc.agent_id = p_user_id;
    ELSE
        RETURN QUERY
        SELECT
            COALESCE(SUM(CASE
                WHEN nc.created_at >= date_trunc('month', now())
                THEN nc.franchise_commission ELSE 0
            END), 0)::numeric,
            COALESCE(SUM(CASE
                WHEN nc.created_at >= date_trunc('month', now()) - interval '1 month'
                 AND nc.created_at < date_trunc('month', now())
                THEN nc.franchise_commission ELSE 0
            END), 0)::numeric,
            CASE
                WHEN COALESCE(SUM(CASE
                    WHEN nc.created_at >= date_trunc('month', now()) - interval '1 month'
                     AND nc.created_at < date_trunc('month', now())
                    THEN nc.franchise_commission ELSE 0
                END), 0) = 0 THEN 0
                ELSE ROUND((
                    COALESCE(SUM(CASE
                        WHEN nc.created_at >= date_trunc('month', now())
                        THEN nc.franchise_commission ELSE 0
                    END), 0)::numeric
                    - COALESCE(SUM(CASE
                        WHEN nc.created_at >= date_trunc('month', now()) - interval '1 month'
                         AND nc.created_at < date_trunc('month', now())
                        THEN nc.franchise_commission ELSE 0
                    END), 0)::numeric
                ) / COALESCE(SUM(CASE
                    WHEN nc.created_at >= date_trunc('month', now()) - interval '1 month'
                     AND nc.created_at < date_trunc('month', now())
                    THEN nc.franchise_commission ELSE 0
                END), 1)::numeric * 100, 1)
            END::numeric
        FROM network_commissions nc
        WHERE nc.franchise_id = (SELECT franchise_id FROM profiles WHERE id = p_user_id);
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
