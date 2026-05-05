-- =============================================
-- FASE 2: TABLAS PARA OCR ASÍNCRONO Y REALTIME
-- =============================================
-- Instrucciones: Ejecutar este script en el SQL Editor de Supabase
-- =============================================

CREATE TABLE IF NOT EXISTS public.ocr_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    invoice_data JSONB,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ocr_jobs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Users can view own jobs" ON public.ocr_jobs;
CREATE POLICY "Users can view own jobs" ON public.ocr_jobs 
    FOR SELECT USING (user_id = auth.uid() OR franchise_id = get_my_franchise_id());

DROP POLICY IF EXISTS "Users can insert own jobs" ON public.ocr_jobs;
CREATE POLICY "Users can insert own jobs" ON public.ocr_jobs 
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- We need a Service Role bypass or a specific policy to allow the callback to update the job.
-- Since the callback will use a Service Role Key, it automatically bypasses RLS.
-- Therefore, we don't need a public UPDATE policy.

-- Enable Realtime for ocr_jobs so the frontend can listen to changes
-- 'supabase_realtime' publication needs to include ocr_jobs
BEGIN;
  -- Drop from publication if exists to avoid errors, then add
  ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS public.ocr_jobs;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.ocr_jobs;
COMMIT;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_ocr_jobs_updated_at ON public.ocr_jobs;
CREATE TRIGGER set_ocr_jobs_updated_at
BEFORE UPDATE ON public.ocr_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_current_timestamp_updated_at();
