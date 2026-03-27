-- =============================================
-- FASE 8: Academy Resources - Tabla completa
-- =============================================

-- Crear tabla
CREATE TABLE IF NOT EXISTS public.academy_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL DEFAULT 'training'
        CHECK (category IN ('training', 'contract', 'marketing')),
    file_url TEXT NOT NULL,
    file_type TEXT DEFAULT 'pdf'
        CHECK (file_type IN ('pdf', 'video', 'link')),
    role_restriction TEXT NOT NULL DEFAULT 'agent'
        CHECK (role_restriction IN ('agent', 'franchise', 'admin')),
    is_published BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_academy_resources_published
    ON public.academy_resources (is_published, category);

-- Trigger updated_at
DROP TRIGGER IF EXISTS handle_updated_at_academy_resources ON public.academy_resources;
CREATE TRIGGER handle_updated_at_academy_resources
    BEFORE UPDATE ON public.academy_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.academy_resources ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas previas
DROP POLICY IF EXISTS "rls_academy_admin_all" ON public.academy_resources;
DROP POLICY IF EXISTS "rls_academy_agent_select" ON public.academy_resources;
DROP POLICY IF EXISTS "Users can view allowed resources" ON public.academy_resources;
DROP POLICY IF EXISTS "Admins can manage resources" ON public.academy_resources;

-- Solo admin puede gestionar
CREATE POLICY "rls_academy_admin_all" ON public.academy_resources
    FOR ALL USING (public.is_superadmin());

-- Agentes y franquicias ven recursos publicados según su rol
CREATE POLICY "rls_academy_agent_select" ON public.academy_resources
    FOR SELECT USING (
        is_published = true
        AND (
            role_restriction = 'agent'
            OR (role_restriction = 'franchise' AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role IN ('franchise', 'admin')
            ))
            OR role_restriction = 'admin' AND EXISTS (
                SELECT 1 FROM public.profiles
                WHERE id = auth.uid() AND role = 'admin'
            )
        )
    );

-- Seed inicial (solo si la tabla está vacía)
INSERT INTO public.academy_resources (title, description, category, file_url, file_type, role_restriction, is_published)
SELECT 'Manual de Bienvenida', 'Guía completa para nuevos colaboradores', 'training', '#', 'pdf', 'agent', true
WHERE NOT EXISTS (SELECT 1 FROM public.academy_resources LIMIT 1);
