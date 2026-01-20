/* SPRINT 3: COMISIONES Y GAMIFICACION */

-- 1. Table for Commissions Tracking
CREATE TABLE IF NOT EXISTS network_commissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id UUID REFERENCES proposals(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES profiles(id),
    franchise_id UUID REFERENCES profiles(id),
    
    total_revenue NUMERIC NOT NULL, -- Total amount from the energy deal
    agent_commission NUMERIC NOT NULL,
    franchise_profit NUMERIC NOT NULL,
    hq_royalty NUMERIC NOT NULL,
    
    status TEXT CHECK (status IN ('pending', 'cleared', 'paid')) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Table for Leaderboard / Points
CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) UNIQUE,
    points INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]', -- Array of badge strings
    last_updated TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE network_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

-- 4. Policies
-- Admins see everything
DROP POLICY IF EXISTS "Admins see all commissions" ON network_commissions;
CREATE POLICY "Admins see all commissions" ON network_commissions 
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Franchises see commissions related to them or their agents
DROP POLICY IF EXISTS "Franchises see their commissions" ON network_commissions;
CREATE POLICY "Franchises see their commissions" ON network_commissions
    FOR SELECT USING (
        franchise_id = auth.uid() OR 
        agent_id IN (SELECT id FROM profiles WHERE parent_id = auth.uid())
    );

-- Agents see only their own commissions
DROP POLICY IF EXISTS "Agents see their own commissions" ON network_commissions;
CREATE POLICY "Agents see their own commissions" ON network_commissions
    FOR SELECT USING (agent_id = auth.uid());

-- Everyone can see the leaderboard (points)
DROP POLICY IF EXISTS "Public leaderboard visibility" ON user_points;
CREATE POLICY "Public leaderboard visibility" ON user_points
    FOR SELECT USING (true);

-- 5. Seed initial leaderboard data
INSERT INTO user_points (user_id, points, badges)
SELECT id, floor(random() * 500 + 100), '["Rookie"]'::jsonb
FROM profiles
ON CONFLICT (user_id) DO NOTHING;
