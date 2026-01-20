/* FIX FOUNDATIONS: Create missing tables and columns for multi-tenancy */

-- 1. Create FRANCHISES table (The tenant level)
CREATE TABLE IF NOT EXISTS franchises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL, -- 'hq', 'madrid-01', etc.
    name TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Update PROFILES to support multi-tenancy correctly
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS franchise_id UUID REFERENCES franchises(id),
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- 3. Seed HQ Franchise (Required for ensureProfile self-healing)
INSERT INTO franchises (slug, name)
VALUES ('hq', 'Zinergia Central')
ON CONFLICT (slug) DO NOTHING;

-- 4. Set default franchise for existing profiles (optional but helpful)
-- UPDATE profiles SET franchise_id = (SELECT id FROM franchises WHERE slug = 'hq') WHERE franchise_id IS NULL;

-- 5. Fix RLS on franchises
ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view franchises" ON franchises
    FOR SELECT USING (true);

CREATE POLICY "Admins can manage franchises" ON franchises
    FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- 6. Re-verify profiles RLS for franchise_id access
-- Users need to be able to select their profile to see their franchise_id
-- This is already covered by "Users can see own profile" in network_setup.sql
