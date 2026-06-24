-- =============================================
-- INVOICE CLOSURE — cierre ligero de la factura en el propio ocr_job
-- =============================================
-- El comercial cierra una factura rellenando: compañía aceptada, tarifa,
-- permanencia (fecha, opcional), check de cerrado y comisión (€) manual.
-- Todo vive en ocr_jobs (enfoque "app sencilla"); no toca el CRM.

ALTER TABLE public.ocr_jobs
    ADD COLUMN IF NOT EXISTS closed            BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS closed_company    TEXT,
    ADD COLUMN IF NOT EXISTS closed_tariff     TEXT,
    ADD COLUMN IF NOT EXISTS permanence_until  DATE,
    ADD COLUMN IF NOT EXISTS commission_amount NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS closed_at         TIMESTAMPTZ;

-- Recordatorio de revisión por permanencia: índice para buscarlas por fecha.
CREATE INDEX IF NOT EXISTS idx_ocr_jobs_permanence
    ON public.ocr_jobs(permanence_until)
    WHERE permanence_until IS NOT NULL AND closed = true;

-- ─────────────────────────────────────────────
-- VIEW invoice_registry — ahora basada solo en ocr_jobs (cierre incluido).
-- ─────────────────────────────────────────────
DROP VIEW IF EXISTS public.invoice_registry;

CREATE VIEW public.invoice_registry
WITH (security_invoker = true) AS
SELECT
    j.id                                   AS job_id,
    j.agent_id,
    j.franchise_id,
    j.created_at,
    j.status                               AS ocr_status,
    j.compared_at,
    j.drive_view_link,
    j.drive_synced_at,
    (j.drive_synced_at IS NOT NULL)        AS archived_in_drive,

    CASE
        WHEN j.closed                  THEN 'closed_won'
        WHEN j.compared_at IS NOT NULL  THEN 'compared'
        WHEN j.status = 'completed'     THEN 'ocr_done'
        WHEN j.status = 'failed'        THEN 'failed'
        ELSE 'uploaded'
    END                                    AS process_status,

    -- Datos OCR (extracted_data es JSONB plano).
    j.extracted_data->>'client_name'       AS titular,
    j.extracted_data->>'company_name'      AS comercializadora_actual,
    j.extracted_data->>'cups'              AS cups,
    j.extracted_data->>'total_amount'      AS importe_total,
    j.extracted_data->>'tariff_name'       AS tarifa_actual,

    -- Cierre (en el propio job).
    j.closed,
    j.closed_company                       AS compania_contratada,
    j.closed_tariff                        AS tarifa_contratada,
    j.permanence_until                     AS permanencia_hasta,
    j.commission_amount,
    j.closed_at
FROM public.ocr_jobs j;

GRANT SELECT ON public.invoice_registry TO authenticated;
