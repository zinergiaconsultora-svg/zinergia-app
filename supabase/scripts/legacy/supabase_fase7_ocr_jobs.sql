-- =============================================
-- FASE 7: Pipeline OCR Historial
-- =============================================

CREATE TABLE IF NOT EXISTS public.ocr_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
    agent_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    file_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    attempts INTEGER NOT NULL DEFAULT 1,
    error_message TEXT,
    extracted_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para updated_at (requiere que exista la funcion handle_updated_at en public)
DROP TRIGGER IF EXISTS handle_updated_at_ocr_jobs ON public.ocr_jobs;
CREATE TRIGGER handle_updated_at_ocr_jobs
    BEFORE UPDATE ON public.ocr_jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY;

-- Limpiar politicas previas por si se corre de nuevo
DROP POLICY IF EXISTS "rls_ocr_jobs_admin_all" ON ocr_jobs;
DROP POLICY IF EXISTS "rls_ocr_jobs_agent_select" ON ocr_jobs;
DROP POLICY IF EXISTS "rls_ocr_jobs_agent_insert" ON ocr_jobs;
DROP POLICY IF EXISTS "rls_ocr_jobs_agent_update" ON ocr_jobs;

-- Policies
CREATE POLICY "rls_ocr_jobs_admin_all" ON ocr_jobs
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "rls_ocr_jobs_agent_select" ON ocr_jobs
    FOR SELECT USING (
        franchise_id = public.get_my_franchise_id() OR agent_id = auth.uid()
    );

CREATE POLICY "rls_ocr_jobs_agent_insert" ON ocr_jobs
    FOR INSERT WITH CHECK (
        agent_id = auth.uid()
        AND (franchise_id IS NULL OR franchise_id = public.get_my_franchise_id())
    );

CREATE POLICY "rls_ocr_jobs_agent_update" ON ocr_jobs
    FOR UPDATE USING (
        agent_id = auth.uid() OR franchise_id = public.get_my_franchise_id()
    );
