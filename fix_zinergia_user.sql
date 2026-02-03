-- =============================================
-- VERIFICAR Y ARREGLAR USUARIO zinergiaconsultora@gmail.com
-- =============================================
-- Ejecutar esto en el SQL Editor de Supabase:
-- https://supabase.com/dashboard/project/gmjgkzaxmkaggsyczwcm/sql/new
-- =============================================

-- 1. Verificar si el usuario existe en auth.users
SELECT id, email, email_confirmed_at, created_at 
FROM auth.users 
WHERE email = 'zinergiaconsultora@gmail.com';

-- 2. Verificar si tiene perfil en profiles
SELECT id, email, full_name, role, franchise_id, created_at
FROM profiles 
WHERE email = 'zinergiaconsultora@gmail.com';

-- 3. Crear/Actualizar el perfil del usuario
-- NOTA: Reemplaza 'USER_ID_FROM_STEP_1' con el ID que apareció en el paso 1
INSERT INTO profiles (id, email, full_name, role, franchise_id, created_at, updated_at)
VALUES (
    'USER_ID_FROM_STEP_1',  -- Reemplazar con el ID real del usuario de auth.users
    'zinergiaconsultora@gmail.com',
    'Zinergia Consultora',
    'admin',
    (SELECT id FROM franchises WHERE slug = 'hq' LIMIT 1),
    NOW(),
    NOW()
)
ON CONFLICT (id) DO UPDATE 
SET 
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    franchise_id = EXCLUDED.franchise_id,
    updated_at = NOW();

-- 4. Verificar resultado final
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at,
    p.full_name,
    p.role,
    f.name as franchise
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN franchises f ON p.franchise_id = f.id
WHERE u.email = 'zinergiaconsultora@gmail.com';
