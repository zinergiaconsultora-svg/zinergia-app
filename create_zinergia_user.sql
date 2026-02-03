-- =============================================
-- DIAGNÓSTICO Y CREACIÓN DE USUARIO zinergiaconsultora@gmail.com
-- =============================================
-- Ejecutar en: https://supabase.com/dashboard/project/gmjgkzaxmkaggsyczwcm/sql/new
-- =============================================

-- PASO 1: Verificar si el usuario existe
SELECT 'USUARIO EN AUTH.USERS' as info, id, email, email_confirmed_at, created_at, updated_at
FROM auth.users
WHERE email = 'zinergiaconsultora@gmail.com';

-- PASO 2: Verificar si tiene perfil
SELECT 'PERFIL EN PROFILES' as info, id, email, full_name, role, franchise_id
FROM profiles
WHERE email = 'zinergiaconsultora@gmail.com';

-- PASO 3: Si NO existe el usuario, crearlo con contraseña válida
-- Primero generamos un UUID para el usuario
DO $$
DECLARE
    user_id uuid := gen_random_uuid();
    franchise_id uuid;
BEGIN
    -- Obtener o crear la franquicia HQ
    INSERT INTO franchises (slug, name)
    VALUES ('hq', 'Zinergia Central')
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO franchise_id;

    IF franchise_id IS NULL THEN
        SELECT id INTO franchise_id FROM franchises WHERE slug = 'hq';
    END IF;

    -- Crear el usuario en auth.users con contraseña 'zinergia123'
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
        user_id,
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
    )
    ON CONFLICT (email) DO NOTHING;

    -- Crear el perfil en public.profiles
    INSERT INTO profiles (id, email, full_name, role, franchise_id, created_at, updated_at)
    VALUES (
        user_id,
        'zinergiaconsultora@gmail.com',
        'Zinergia Consultora',
        'admin',
        franchise_id,
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        franchise_id = EXCLUDED.franchise_id,
        updated_at = now();

    RAISE NOTICE 'Usuario creado exitosamente con ID: %', user_id;
END $$;

-- PASO 4: Verificar que el usuario fue creado correctamente
SELECT 'VERIFICACIÓN FINAL' as info,
    u.id,
    u.email,
    u.email_confirmed_at,
    p.full_name,
    p.role,
    f.name as franchise,
    'Contraseña: zinergia123' as password
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN franchises f ON p.franchise_id = f.id
WHERE u.email = 'zinergiaconsultora@gmail.com';

-- PASO 5: Si el usuario YA existía pero tenía mala contraseña, actualizarla
UPDATE auth.users
SET
    encrypted_password = crypt('zinergia123', gen_salt('bf')),
    updated_at = now()
WHERE email = 'zinergiaconsultora@gmail.com';

SELECT 'CONTRASEÑA ACTUALIZADA' as info, email, 'zinergia123' as new_password
FROM auth.users
WHERE email = 'zinergiaconsultora@gmail.com';
