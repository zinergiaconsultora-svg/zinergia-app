-- =============================================
-- LEAD LOST + registro enriquecido para el cockpit admin
-- =============================================
-- Un lead que NO acepta la oferta se marca como perdido (closed_lost), para
-- medir bien la tasa de conversión. La VIEW expone además el nombre del comercial
-- y de la franquicia para el cockpit /admin/leads.

ALTER TABLE public.ocr_jobs
    ADD COLUMN IF NOT EXISTS lost        BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS lost_at     TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS lost_reason TEXT;

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
        WHEN j.lost                     THEN 'closed_lost'
        WHEN j.compared_at IS NOT NULL  THEN 'compared'
        WHEN j.status = 'completed'     THEN 'ocr_done'
        WHEN j.status = 'failed'        THEN 'failed'
        ELSE 'uploaded'
    END                                    AS process_status,

    j.extracted_data->>'client_name'       AS titular,
    j.extracted_data->>'company_name'      AS comercializadora_actual,
    j.extracted_data->>'cups'              AS cups,
    j.extracted_data->>'total_amount'      AS importe_total,
    j.extracted_data->>'tariff_name'       AS tarifa_actual,

    -- Cierre
    j.closed,
    j.lost,
    j.lost_reason,
    j.closed_company                       AS compania_contratada,
    j.closed_tariff                        AS tarifa_contratada,
    j.permanence_until                     AS permanencia_hasta,
    j.commission_amount,
    j.closed_at,

    -- Enriquecido para el cockpit
    p.full_name                            AS agent_name,
    f.name                                 AS franchise_name
FROM public.ocr_jobs j
LEFT JOIN public.profiles p   ON p.id = j.agent_id
LEFT JOIN public.franchises f ON f.id = j.franchise_id;

GRANT SELECT ON public.invoice_registry TO authenticated;
