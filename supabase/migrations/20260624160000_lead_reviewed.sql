-- =============================================
-- LEAD REVIEWED — triaje "pendientes de revisar"
-- =============================================
-- Marca de revisión por el admin (bandeja de entrada de triaje). Añade el campo
-- a ocr_jobs, lo expone en la VIEW (para la cola "pendientes de revisar") y suma
-- el tipo de evento de auditoría correspondiente.

ALTER TABLE public.ocr_jobs
    ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Auditoría: nuevo tipo de evento.
ALTER TABLE public.lead_audit_events DROP CONSTRAINT IF EXISTS lead_audit_events_event_type_check;
ALTER TABLE public.lead_audit_events ADD CONSTRAINT lead_audit_events_event_type_check
    CHECK (event_type IN (
        'note_added','lead_closed_won','lead_marked_lost','lead_reopened',
        'closure_updated','lost_reason_updated','drive_synced','ocr_failed',
        'lead_reassigned','lead_reviewed'
    ));

-- VIEW: añade reviewed_at (resto idéntico a invoice_registry_savings).
DROP VIEW IF EXISTS public.invoice_registry;
CREATE VIEW public.invoice_registry
WITH (security_invoker = true) AS
SELECT
    j.id AS job_id, j.agent_id, j.franchise_id, j.created_at,
    j.status AS ocr_status, j.compared_at, j.drive_view_link, j.drive_synced_at,
    (j.drive_synced_at IS NOT NULL) AS archived_in_drive,
    CASE
        WHEN j.closed THEN 'closed_won'
        WHEN j.lost THEN 'closed_lost'
        WHEN j.compared_at IS NOT NULL THEN 'compared'
        WHEN j.status = 'completed' THEN 'ocr_done'
        WHEN j.status = 'failed' THEN 'failed'
        ELSE 'uploaded'
    END AS process_status,
    j.extracted_data->>'client_name' AS titular,
    j.extracted_data->>'company_name' AS comercializadora_actual,
    j.extracted_data->>'cups' AS cups,
    j.extracted_data->>'total_amount' AS importe_total,
    j.extracted_data->>'tariff_name' AS tarifa_actual,
    j.extracted_data->>'period_days' AS period_days,
    j.closed, j.lost, j.lost_reason,
    j.closed_company AS compania_contratada,
    j.closed_tariff AS tarifa_contratada,
    j.permanence_until AS permanencia_hasta,
    j.commission_amount, j.closed_at,
    j.reviewed_at,
    p.full_name AS agent_name, f.name AS franchise_name,
    pr.annual_savings AS annual_savings,
    pr.savings_percent AS savings_percent,
    (pr.id IS NOT NULL) AS has_proposal
FROM public.ocr_jobs j
LEFT JOIN public.profiles p ON p.id = j.agent_id
LEFT JOIN public.franchises f ON f.id = j.franchise_id
LEFT JOIN LATERAL (
    SELECT id, annual_savings, savings_percent FROM public.proposals
    WHERE client_id = j.client_id ORDER BY created_at DESC LIMIT 1
) pr ON TRUE;
GRANT SELECT ON public.invoice_registry TO authenticated;

-- Analítica: añade alertas "cooling" (abiertos >7 días) y "needs_review".
CREATE OR REPLACE FUNCTION public.get_lead_analytics()
RETURNS json LANGUAGE sql SECURITY INVOKER STABLE SET search_path = public AS $$
    SELECT json_build_object(
        'alerts', (
            SELECT json_build_object(
                'drive_pending',    count(*) FILTER (WHERE drive_synced_at IS NULL),
                'ocr_failed',       count(*) FILTER (WHERE NOT closed AND NOT lost AND compared_at IS NULL AND status = 'failed'),
                'needs_comparison', count(*) FILTER (WHERE NOT closed AND NOT lost AND compared_at IS NULL AND status = 'completed'),
                'permanence_due',   count(*) FILTER (WHERE closed AND permanence_until IS NOT NULL AND permanence_until <= current_date + 30),
                'cooling',          count(*) FILTER (WHERE NOT closed AND NOT lost AND created_at < now() - interval '7 days'),
                'needs_review',     count(*) FILTER (WHERE NOT closed AND NOT lost AND reviewed_at IS NULL)
            ) FROM public.ocr_jobs
        ),
        'by_franchise', COALESCE((
            SELECT json_agg(row_to_json(t)) FROM (
                SELECT f.name AS franchise_name,
                    count(*) FILTER (WHERE j.closed) AS won,
                    count(*) FILTER (WHERE j.lost) AS lost,
                    count(*) FILTER (WHERE NOT j.closed AND NOT j.lost) AS open_leads,
                    coalesce(sum(j.commission_amount) FILTER (WHERE j.closed), 0) AS commission
                FROM public.ocr_jobs j
                LEFT JOIN public.franchises f ON f.id = j.franchise_id
                GROUP BY f.name
                ORDER BY count(*) FILTER (WHERE j.closed) DESC, open_leads DESC
                LIMIT 20
            ) t
        ), '[]'::json),
        'loss_reasons', COALESCE((
            SELECT json_agg(row_to_json(t)) FROM (
                SELECT coalesce(nullif(trim(lost_reason), ''), '(sin motivo)') AS reason, count(*) AS count
                FROM public.ocr_jobs WHERE lost
                GROUP BY 1 ORDER BY count(*) DESC LIMIT 8
            ) t
        ), '[]'::json),
        'pipeline_savings', coalesce((
            SELECT sum(pr.annual_savings) FROM public.ocr_jobs j
            LEFT JOIN LATERAL (
                SELECT annual_savings FROM public.proposals WHERE client_id = j.client_id ORDER BY created_at DESC LIMIT 1
            ) pr ON TRUE
            WHERE NOT j.closed AND NOT j.lost AND pr.annual_savings IS NOT NULL
        ), 0)
    );
$$;
