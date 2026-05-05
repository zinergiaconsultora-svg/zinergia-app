-- Create a default admin user if not exists
-- PLEASE RUN THIS IN SUPABASE SQL EDITOR

-- 1. Create the user in auth.users
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'admin@zinergia.com',
    crypt('admin123', gen_salt('bf')), -- Password: admin123
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin Zinergia"}',
    now(),
    now(),
    'authenticated'
) ON CONFLICT (id) DO NOTHING;

-- 2. Create the HQ Franchise
INSERT INTO public.franchises (slug, name)
VALUES ('hq', 'Zinergia Central')
ON CONFLICT (slug) DO NOTHING;

-- 3. Create the Profile linked to HQ
INSERT INTO public.profiles (id, full_name, role, franchise_id, created_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Admin Zinergia',
    'admin', -- Super admin role
    (SELECT id FROM franchises WHERE slug = 'hq'),
    now()
) ON CONFLICT (id) DO UPDATE 
SET role = 'admin', franchise_id = (SELECT id FROM franchises WHERE slug = 'hq');
