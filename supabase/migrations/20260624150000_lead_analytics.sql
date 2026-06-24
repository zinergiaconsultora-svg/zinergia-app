-- =============================================
-- LEAD ANALYTICS — dashboard admin avanzado
-- =============================================
-- Devuelve, en una sola llamada: alertas operativas (cuadran con las colas del
-- cockpit), conversión por franquicia, motivos de pérdida y valor del pipeline
-- (suma del ahorro real de propuestas de leads abiertos).
-- SECURITY INVOKER: respeta RLS (admin ve todo). La acción ya gatea a admin.

CREATE OR REPLACE FUNCTION public.get_lead_analytics()
RETURNS json
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
    SELECT json_build_object(
        'alerts', (
            SELECT json_build_object(
                'drive_pending',    count(*) FILTER (WHERE drive_synced_at IS NULL),
                'ocr_failed',       count(*) FILTER (WHERE NOT closed AND NOT lost AND compared_at IS NULL AND status = 'failed'),
                'needs_comparison', count(*) FILTER (WHERE NOT closed AND NOT lost AND compared_at IS NULL AND status = 'completed'),
                'permanence_due',   count(*) FILTER (WHERE closed AND permanence_until IS NOT NULL AND permanence_until <= current_date + 30)
            )
            FROM public.ocr_jobs
        ),
        'by_franchise', COALESCE((
            SELECT json_agg(row_to_json(t)) FROM (
                SELECT
                    f.name AS franchise_name,
                    count(*) FILTER (WHERE j.closed)                    AS won,
                    count(*) FILTER (WHERE j.lost)                      AS lost,
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
                SELECT
                    coalesce(nullif(trim(lost_reason), ''), '(sin motivo)') AS reason,
                    count(*) AS count
                FROM public.ocr_jobs
                WHERE lost
                GROUP BY 1
                ORDER BY count(*) DESC
                LIMIT 8
            ) t
        ), '[]'::json),
        'pipeline_savings', coalesce((
            SELECT sum(pr.annual_savings)
            FROM public.ocr_jobs j
            LEFT JOIN LATERAL (
                SELECT annual_savings FROM public.proposals
                WHERE client_id = j.client_id
                ORDER BY created_at DESC LIMIT 1
            ) pr ON TRUE
            WHERE NOT j.closed AND NOT j.lost AND pr.annual_savings IS NOT NULL
        ), 0)
    );
$$;

REVOKE ALL ON FUNCTION public.get_lead_analytics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_analytics() TO authenticated;
