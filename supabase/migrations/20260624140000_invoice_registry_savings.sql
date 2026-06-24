-- =============================================
-- INVOICE REGISTRY — señales de prioridad comercial
-- =============================================
-- Enriquece la VIEW con el ahorro real de la última propuesta (si existe),
-- el % de ahorro, si ya hay propuesta, y los días de facturación (para anualizar
-- la factura cuando no hay propuesta todavía). Alimenta la puntuación de prioridad
-- del cockpit. security_invoker → respeta la RLS de ocr_jobs y proposals.

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
    j.extracted_data->>'period_days'       AS period_days,
    j.closed,
    j.lost,
    j.lost_reason,
    j.closed_company                       AS compania_contratada,
    j.closed_tariff                        AS tarifa_contratada,
    j.permanence_until                     AS permanencia_hasta,
    j.commission_amount,
    j.closed_at,
    p.full_name                            AS agent_name,
    f.name                                 AS franchise_name,
    -- Señales de prioridad: ahorro real de la propuesta más reciente.
    pr.annual_savings                      AS annual_savings,
    pr.savings_percent                     AS savings_percent,
    (pr.id IS NOT NULL)                    AS has_proposal
FROM public.ocr_jobs j
LEFT JOIN public.profiles p   ON p.id = j.agent_id
LEFT JOIN public.franchises f ON f.id = j.franchise_id
LEFT JOIN LATERAL (
    SELECT id, annual_savings, savings_percent
    FROM public.proposals
    WHERE client_id = j.client_id
    ORDER BY created_at DESC
    LIMIT 1
) pr ON TRUE;

GRANT SELECT ON public.invoice_registry TO authenticated;
