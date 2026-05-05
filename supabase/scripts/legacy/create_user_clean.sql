-- =============================================
-- CREAR USUARIO zinergiaconsultora@gmail.com
-- Contraseña: zinergia123
-- =============================================

-- 1. Eliminar usuario si existe (para evitar conflictos)
DELETE FROM profiles WHERE email = 'zinergiaconsultora@gmail.com';
DELETE FROM auth.users WHERE email = 'zinergiaconsultora@gmail.com';

-- 2. Asegurarse de que existe la franquicia HQ
INSERT INTO franchises (slug, name)
VALUES ('hq', 'Zinergia Central')
ON CONFLICT (slug) DO NOTHING;

-- 3. Crear el usuario con contraseña 'zinergia123'
INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    raw_app_meta_data,
    created_at,
    updated_at,
    last_sign_in_at
)
VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'zinergiaconsultora@gmail.com',
    crypt('zinergia123', gen_salt('bf')),
    now(),
    '{"full_name":"Zinergia Consultora"}',
    '{"provider":"email","providers":["email"]}',
    now(),
    now(),
    now()
);

-- 4. Crear el perfil en public.profiles
INSERT INTO profiles (id, email, full_name, role, franchise_id, created_at, updated_at)
SELECT
    (SELECT id FROM auth.users WHERE email = 'zinergiaconsultora@gmail.com'),
    'zinergiaconsultora@gmail.com',
    'Zinergia Consultora',
    'admin',
    (SELECT id FROM franchises WHERE slug = 'hq'),
    now(),
    now();

-- 5. Verificación
SELECT
    u.id as user_id,
    u.email,
    u.email_confirmed_at,
    p.full_name,
    p.role,
    f.name as franchise,
    '✓ USUARIO CREADO CORRECTAMENTE' as status,
    'Contraseña: zinergia123' as password
FROM auth.users u
JOIN profiles p ON u.id = p.id
JOIN franchises f ON p.franchise_id = f.id
WHERE u.email = 'zinergiaconsultora@gmail.com';
