-- =============================================
-- OCR Zombie Jobs: marcar como failed tras 10 min
-- Requiere pg_cron habilitado en Supabase
-- (Dashboard → Database → Extensions → pg_cron)
-- =============================================

-- 1. Habilitar extensión (solo si no está activa)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Función que limpia jobs zombie
CREATE OR REPLACE FUNCTION public.expire_zombie_ocr_jobs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.ocr_jobs
    SET
        status = 'failed',
        error_message = 'Timeout automático: sin respuesta del procesador OCR en 10 minutos.'
    WHERE
        status = 'processing'
        AND created_at < now() - INTERVAL '10 minutes';
END;
$$;

-- 3. Cron: ejecutar cada 5 minutos
-- Eliminar job previo si existe (para reejecutar este script sin error)
SELECT cron.unschedule('expire-zombie-ocr-jobs')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'expire-zombie-ocr-jobs'
);

SELECT cron.schedule(
    'expire-zombie-ocr-jobs',   -- nombre del job
    '*/5 * * * *',              -- cada 5 minutos
    'SELECT public.expire_zombie_ocr_jobs();'
);
