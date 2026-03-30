-- =============================================
-- OCR Retry Fix: añadir file_url a ocr_jobs
-- y bucket de storage para facturas
-- =============================================

-- 1. Añadir columna file_url para poder reintentar
ALTER TABLE public.ocr_jobs
    ADD COLUMN IF NOT EXISTS file_url TEXT;

-- 2. Crear bucket privado para facturas OCR (si no existe)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'ocr-invoices',
    'ocr-invoices',
    false,
    10485760, -- 10 MB
    ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS para el bucket: solo el agente propietario puede leer/escribir
DROP POLICY IF EXISTS "ocr_invoices_insert" ON storage.objects;
DROP POLICY IF EXISTS "ocr_invoices_select" ON storage.objects;
DROP POLICY IF EXISTS "ocr_invoices_delete" ON storage.objects;

CREATE POLICY "ocr_invoices_insert" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'ocr-invoices'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "ocr_invoices_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'ocr-invoices'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "ocr_invoices_delete" ON storage.objects
    FOR DELETE USING (
        bucket_id = 'ocr-invoices'
        AND auth.uid()::text = (storage.foldername(name))[1]
    );
