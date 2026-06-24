-- =============================================
-- INVOICE LIFECYCLE — purga del binario en Supabase tras archivar en Drive
-- =============================================
-- Tras confirmar drive_synced_at y pasados N días, el binario en Supabase
-- (staging) se purga; Drive queda como archivo oficial. Esta columna marca
-- cuándo se purgó para no reprocesar.

ALTER TABLE public.ocr_jobs
    ADD COLUMN IF NOT EXISTS binary_purged_at TIMESTAMPTZ;

-- Cola del ciclo de vida: ya archivadas en Drive, con binario aún en Supabase.
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_binary_to_purge
    ON public.ocr_jobs(drive_synced_at)
    WHERE drive_synced_at IS NOT NULL AND binary_purged_at IS NULL;
