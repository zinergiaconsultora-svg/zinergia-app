-- =============================================
-- FASE 8: Academy Admin - añadir is_published
-- =============================================

-- Añadir columna is_published si no existe
ALTER TABLE public.academy_resources
    ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT true;

-- Índice para filtrar por publicados
CREATE INDEX IF NOT EXISTS idx_academy_resources_published
    ON public.academy_resources (is_published, category);

-- Actualizar trigger updated_at (reutiliza handle_updated_at existente)
DROP TRIGGER IF EXISTS handle_updated_at_academy_resources ON public.academy_resources;
CREATE TRIGGER handle_updated_at_academy_resources
    BEFORE UPDATE ON public.academy_resources
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
