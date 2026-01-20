-- =============================================
-- ZINERGIA FIX: PROFILES SCHEMA
-- =============================================
-- Fix for Error 400: "avatar_url" column missing in profiles
-- =============================================

-- 1. Ensure 'profiles' has standard columns needed for Dashboard
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS full_name TEXT,
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- 2. Update Gamification/Points Table (Just in case it wasn't created by previous scripts)
CREATE TABLE IF NOT EXISTS user_points (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0,
    badges JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT unique_user_points UNIQUE(user_id)
);

-- Enable RLS for Points
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own points" ON user_points
    FOR SELECT USING (auth.uid() = user_id);

-- Only system/triggers manage points usually, but for dev we might allow:
-- (Realistically should be stricter, but this unblocks the app)
