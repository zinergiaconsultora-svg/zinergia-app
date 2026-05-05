-- =============================================
-- VERIFICAR PERFIL DEL USUARIO
-- =============================================

-- Verificar si tiene perfil
SELECT
    p.id,
    p.email,
    p.full_name,
    p.role,
    p.franchise_id,
    f.name as franchise_name,
    'PERFIL ENCONTRADO' as status
FROM profiles p
LEFT JOIN franchises f ON p.franchise_id = f.id
WHERE p.email = 'zinergiaconsultora@gmail.com';

-- Si no devuelve resultados, el perfil NO existe y hay que crearlo:
-- Ejecutar esto SOLO si el query anterior no devuelve nada:

-- Obtener el ID del usuario de auth.users y crear el perfil
INSERT INTO profiles (id, email, full_name, role, franchise_id, created_at, updated_at)
SELECT
    u.id,
    u.email,
    u.raw_user_meta_data->>'full_name',
    'admin',
    (SELECT id FROM franchises WHERE slug = 'hq'),
    now(),
    now()
FROM auth.users u
WHERE u.email = 'zinergiaconsultora@gmail.com'
AND NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.email = 'zinergiaconsultora@gmail.com'
);

-- Verificar después de crear
SELECT 'VERIFICACIÓN FINAL' as info,
    u.id as user_id,
    u.email,
    p.full_name,
    p.role,
    f.name as franchise,
    CASE WHEN p.id IS NOT NULL THEN '✓ PERFIL OK' ELSE '✗ SIN PERFIL' END as profile_status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.id
LEFT JOIN franchises f ON p.franchise_id = f.id
WHERE u.email = 'zinergiaconsultora@gmail.com';
