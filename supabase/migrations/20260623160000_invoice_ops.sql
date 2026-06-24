-- =============================================
-- INVOICE OPS — bucket ocr-invoices + recordatorio de permanencia
-- =============================================

-- ─────────────────────────────────────────────
-- 1. Bucket de Storage para las facturas subidas (faltaba en el proyecto).
--    Necesario para que el OCR guarde el original y la reconciliación pueda
--    re-descargarlo. La subida usa el path "{userId}/...".
-- ─────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('ocr-invoices', 'ocr-invoices', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: cada usuario gestiona solo su propia carpeta (primer segmento = su uid).
CREATE POLICY "ocr_invoices_insert_own"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'ocr-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ocr_invoices_select_own"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'ocr-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ocr_invoices_update_own"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'ocr-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "ocr_invoices_delete_own"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'ocr-invoices' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ─────────────────────────────────────────────
-- 2. Recordatorio de permanencia: marca de "ya avisado" para no duplicar.
-- ─────────────────────────────────────────────
ALTER TABLE public.ocr_jobs
    ADD COLUMN IF NOT EXISTS permanence_reminded_at TIMESTAMPTZ;

-- Índice para el cron: cerradas con permanencia aún sin avisar.
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_permanence_due
    ON public.ocr_jobs(permanence_until)
    WHERE closed = true AND permanence_until IS NOT NULL AND permanence_reminded_at IS NULL;
