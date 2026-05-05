-- =============================================
-- REPARAR USUARIO EXISTENTE zinergiaconsultora@gmail.com
-- =============================================

-- 1. Verificar usuario existente
SELECT id, email, email_confirmed_at FROM auth.users 
WHERE email = 'zinergiaconsultora@gmail.com';

-- 2. Eliminar perfil duplicado si existe
DELETE FROM profiles WHERE id = '30de15d0-c3ee-4f56-a86a-fb92074735fe';

-- 3. Asegurar franquicia HQ
INSERT INTO franchises (slug, name)
VALUES ('hq', 'Zinergia Central')
ON CONFLICT (slug) DO NOTHING;

-- 4. Crear perfil correctamente usando el ID del usuario existente
INSERT INTO profiles (id, email, full_name, role, franchise_id, created_at, updated_at)
SELECT
    id,
    'zinergiaconsultora@gmail.com',
    'Zinergia Consultora',
    'admin',
    (SELECT id FROM franchises WHERE slug = 'hq'),
    now(),
    now()
FROM auth.users
WHERE email = 'zinergiaconsultora@gmail.com';

-- 5. Resetear contraseña
UPDATE auth.users
SET encrypted_password = crypt('zinergia123', gen_salt('bf')),
    updated_at = now()
WHERE email = 'zinergiaconsultora@gmail.com';

-- 6. Verificación final
SELECT
    u.id,
    u.email,
    p.full_name,
    p.role,
    f.name as franchise,
    '✓ USUARIO REPARADO' as status,
    'Contraseña: zinergia123' as password
FROM auth.users u
JOIN profiles p ON u.id = p.id
JOIN franchises f ON p.franchise_id = f.id
WHERE u.email = 'zinergiaconsultora@gmail.com';