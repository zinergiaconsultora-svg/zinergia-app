-- Create simulation_history table
CREATE TABLE IF NOT EXISTS simulation_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    invoice_data JSONB NOT NULL,
    results JSONB NOT NULL,
    is_mock BOOLEAN DEFAULT false,
    total_savings DECIMAL(10, 2) NOT NULL,
    best_offer_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Index for faster queries
    INDEX idx_user_created (user_id, created_at DESC)
);

-- Enable RLS
ALTER TABLE simulation_history ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own simulations"
    ON simulation_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own simulations"
    ON simulation_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own simulations"
    ON simulation_history FOR DELETE
    USING (auth.uid() = user_id);

-- Create shared_simulations table for sharing results
CREATE TABLE IF NOT EXISTS shared_simulations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    simulation_id UUID REFERENCES simulation_history(id) ON DELETE CASCADE NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    
    -- Index for slug lookup
    INDEX idx_slug (slug)
);

-- Enable RLS
ALTER TABLE shared_simulations ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view shared simulations
CREATE POLICY "Anyone can view shared simulations"
    ON shared_simulations FOR SELECT
    USING (true);

-- Function to cleanup expired shares
CREATE OR REPLACE FUNCTION cleanup_expired_shares()
RETURNS void AS $$
BEGIN
    DELETE FROM shared_simulations
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Index for faster queries with history
CREATE INDEX IF NOT EXISTS idx_simulation_history_user_created 
ON simulation_history(user_id, created_at DESC);
