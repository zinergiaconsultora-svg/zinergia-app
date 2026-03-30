-- =============================================
-- Seguimiento automático de propuestas enviadas
-- Añadir columna followup_sent_at para no notificar dos veces
-- =============================================

ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS followup_3d_at TIMESTAMPTZ,  -- cuándo se envió el recordatorio de 3 días
    ADD COLUMN IF NOT EXISTS followup_7d_at TIMESTAMPTZ;  -- cuándo se envió el recordatorio de 7 días

-- =============================================
-- pg_cron: llamar al endpoint de Vercel cada día a las 9:00 UTC
-- Alternativa si no usas Vercel Cron nativo
-- Requiere pg_cron + pg_net habilitados en Supabase
-- =============================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Limpiar job previo
SELECT cron.unschedule('proposal-followup-daily')
WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'proposal-followup-daily'
);

-- Cron diario a las 9:00 UTC
SELECT cron.schedule(
    'proposal-followup-daily',
    '0 9 * * *',
    $$
    SELECT net.http_get(
        url := 'https://zinergia.vercel.app/api/cron/proposal-followup',
        headers := jsonb_build_object(
            'Authorization', 'Bearer 01f7e51438061c77498c6ad3e448833d80b9629e28587dd756dcf96e80b1b40a'
        )
    );
    $$
);
