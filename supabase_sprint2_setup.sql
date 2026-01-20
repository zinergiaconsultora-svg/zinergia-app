-- SPRINT 2: GEO-INTELLIGENCE & ACADEMY

-- 0. Ensure user_role type exists (just in case)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'franchise', 'agent');
    END IF;
END $$;

-- 1. Extend Clients for Geolocation
ALTER TABLE clients 
ADD COLUMN IF NOT EXISTS zip_code TEXT,
ADD COLUMN IF NOT EXISTS city TEXT,
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC;

-- 2. Create Academy Resources Table
CREATE TABLE IF NOT EXISTS academy_resources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT DEFAULT 'training', -- 'contract', 'training', 'marketing'
    file_url TEXT NOT NULL,
    file_type TEXT, -- 'pdf', 'video', 'link'
    role_restriction user_role DEFAULT 'agent', -- Minimum role required to see it
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS for Academy
ALTER TABLE academy_resources ENABLE ROW LEVEL SECURITY;

-- 4. Academy Policies
-- Everyone can select (view) resources they are allowed to by role
CREATE POLICY "Users can view allowed resources" ON academy_resources
    FOR SELECT USING (
        CASE 
            WHEN role_restriction = 'admin' THEN (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
            WHEN role_restriction = 'franchise' THEN (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'franchise')))
            ELSE TRUE
        END
    );

-- Only Admin can insert/update/delete
CREATE POLICY "Admins can manage resources" ON academy_resources
    FOR ALL USING (
        EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- 5. Seed some initial data for Academy (Optional but helpful for testing)
INSERT INTO academy_resources (title, description, category, file_url, file_type, role_restriction)
VALUES 
('Manual de Bienvenida Nexus', 'Guía completa para nuevos colaboradores', 'training', '#', 'pdf', 'agent'),
('Modelo de Contrato Franquicia', 'Documento legal para nuevas adhesiones', 'contract', '#', 'pdf', 'franchise'),
('Kit de Marketing 2024', 'Logos, banners y presentaciones oficiales', 'marketing', '#', 'pdf', 'agent');
