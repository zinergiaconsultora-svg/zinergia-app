-- =============================================
-- INVOICE DRIVE — Archivo de facturas en Google Drive
-- =============================================
-- Añade:
--   1. integration_credentials  — refresh token OAuth cifrado (service_role only)
--   2. profiles.drive_folder_id  — carpeta de Drive por COMERCIAL (idempotencia)
--   3. ocr_jobs.drive_*          — enlace al fichero en Drive + estado de ciclo
-- Decisiones: docs/plans/2026-06-23-facturas-google-drive.md

-- ─────────────────────────────────────────────
-- 1. Credenciales de integración (refresh token cifrado)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.integration_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider TEXT NOT NULL UNIQUE,              -- p.ej. 'google_drive'
    encrypted_refresh_token TEXT NOT NULL,      -- AES-256-GCM (lib/crypto/pii.ts)
    access_token TEXT,                          -- cache del access token vigente
    access_token_expires_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'degraded')),
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS habilitada SIN políticas permisivas: solo service_role (bypass) accede.
-- El refresh token nunca debe ser legible por usuarios autenticados.
ALTER TABLE public.integration_credentials ENABLE ROW LEVEL SECURITY;

-- Defensa en profundidad: revocar los grants por defecto de Supabase sobre esta
-- tabla de secretos, para que ni siquiera un fallo futuro de RLS la exponga.
REVOKE ALL ON public.integration_credentials FROM anon, authenticated;

DROP TRIGGER IF EXISTS integration_credentials_updated_at ON public.integration_credentials;
CREATE TRIGGER integration_credentials_updated_at
    BEFORE UPDATE ON public.integration_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
-- 2. Carpeta de Drive cacheada por COMERCIAL (una carpeta por usuario, nombrada
--    con su full_name; dentro van todas las facturas que ese comercial sube).
-- ─────────────────────────────────────────────
-- El claim atómico (UPDATE ... WHERE drive_folder_id IS NULL) evita carpetas
-- duplicadas si dos subidas del mismo comercial llegan a la vez.
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS drive_folder_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_drive_folder_id
    ON public.profiles(drive_folder_id)
    WHERE drive_folder_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- 3. Enlace Drive + estado de ciclo en ocr_jobs
--    (cada factura subida = un ocr_job, con agent_id y status).
-- ─────────────────────────────────────────────
-- El estado del ciclo se DERIVA, sin columna nueva redundante:
--   status='processing' → subida   ·  status='completed' → ocr_done
--   status='failed'     → fallida   ·  compared_at IS NOT NULL → comparativa enviada
-- El cierre (won/lost) se deriva del cliente vinculado en la VIEW (Fase 4).
-- Nota: el dedup de facturas ya lo cubre ocr_jobs.file_content_hash (capture.ts);
-- no añadimos otro hash. La idempotencia de archivado es por job (drive_synced_at).
ALTER TABLE public.ocr_jobs
    ADD COLUMN IF NOT EXISTS drive_file_id   TEXT,
    ADD COLUMN IF NOT EXISTS drive_view_link TEXT,
    ADD COLUMN IF NOT EXISTS drive_synced_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS compared_at     TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_ocr_jobs_drive_file_id
    ON public.ocr_jobs(drive_file_id)
    WHERE drive_file_id IS NOT NULL;

-- Cola de reconciliación: facturas subidas pero aún no archivadas en Drive.
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_pending_drive
    ON public.ocr_jobs(created_at)
    WHERE drive_synced_at IS NULL;
