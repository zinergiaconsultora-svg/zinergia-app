-- Enable pg_trgm for fuzzy search if not enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CLIENTS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_clients_franchise_id ON clients(franchise_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner_id ON clients(owner_id);
CREATE INDEX IF NOT EXISTS idx_clients_status ON clients(status);
-- Text Search Indexes (GIN for ILIKE/pg_trgm)
CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON clients USING GIN (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_clients_cups_trgm ON clients USING GIN (cups gin_trgm_ops);
-- PROPOSALS TABLE INDEXES
CREATE INDEX IF NOT EXISTS idx_proposals_franchise_id ON proposals(franchise_id);
CREATE INDEX IF NOT EXISTS idx_proposals_client_id ON proposals(client_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at DESC);
-- MESSAGES / ACTIVITY (If applicable, future proofing)
-- CREATE INDEX IF NOT EXISTS idx_activity_created_at ON activity_log(created_at DESC);