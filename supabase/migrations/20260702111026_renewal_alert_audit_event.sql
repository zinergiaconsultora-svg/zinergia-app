-- =============================================
-- RENEWAL ALERT AUDIT EVENT — permanencias a 60 días
-- =============================================
-- Alinea la cola de renovaciones con SPEC-renovaciones:
-- el cron de permanencias escribe un evento específico y las métricas agregadas
-- cuentan clientes cerrados cuya permanencia vence en los próximos 60 días.

ALTER TABLE public.lead_audit_events
    DROP CONSTRAINT IF EXISTS lead_audit_events_event_type_check;

ALTER TABLE public.lead_audit_events
    ADD CONSTRAINT lead_audit_events_event_type_check
    CHECK (event_type IN (
        'note_added',
        'lead_closed_won',
        'lead_marked_lost',
        'lead_reopened',
        'closure_updated',
        'lost_reason_updated',
        'drive_synced',
        'ocr_failed',
        'lead_reassigned',
        'lead_reviewed',
        'renewal_alert'
    ));

CREATE OR REPLACE FUNCTION public.get_lead_metrics()
RETURNS json
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
    SELECT json_build_object(
        'open_leads',          count(*) FILTER (WHERE NOT closed AND NOT lost),
        'won_total',           count(*) FILTER (WHERE closed),
        'lost_total',          count(*) FILTER (WHERE lost),
        'clients_this_month',  count(*) FILTER (WHERE closed AND closed_at >= date_trunc('month', now())),
        'commission_total',    coalesce(sum(commission_amount) FILTER (WHERE closed), 0),
        'commission_this_month', coalesce(sum(commission_amount) FILTER (WHERE closed AND closed_at >= date_trunc('month', now())), 0),
        'pending_drive',       count(*) FILTER (WHERE drive_synced_at IS NULL),
        'permanence_due_60',   count(*) FILTER (WHERE closed AND permanence_until IS NOT NULL AND permanence_until <= current_date + 60),
        'funnel', json_build_object(
            'uploaded', count(*),
            'ocr_done', count(*) FILTER (WHERE status = 'completed'),
            'compared', count(*) FILTER (WHERE compared_at IS NOT NULL),
            'won',      count(*) FILTER (WHERE closed)
        )
    )
    FROM public.ocr_jobs;
$$;

REVOKE EXECUTE ON FUNCTION public.get_lead_metrics() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_metrics() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_lead_analytics()
RETURNS json
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public, private
AS $$
BEGIN
    IF NOT private.is_admin() THEN
        RAISE EXCEPTION 'Forbidden: admin only';
    END IF;

    RETURN (
        SELECT json_build_object(
            'alerts', (
                SELECT json_build_object(
                    'drive_pending',    count(*) FILTER (WHERE drive_synced_at IS NULL),
                    'ocr_failed',       count(*) FILTER (WHERE NOT closed AND NOT lost AND compared_at IS NULL AND status = 'failed'),
                    'needs_comparison', count(*) FILTER (WHERE NOT closed AND NOT lost AND compared_at IS NULL AND status = 'completed'),
                    'permanence_due',   count(*) FILTER (WHERE closed AND permanence_until IS NOT NULL AND permanence_until <= current_date + 60),
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
                    SELECT annual_savings
                    FROM public.proposals
                    WHERE client_id = j.client_id
                    ORDER BY created_at DESC
                    LIMIT 1
                ) pr ON TRUE
                WHERE NOT j.closed
                  AND NOT j.lost
                  AND pr.annual_savings IS NOT NULL
            ), 0)
        )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.get_lead_analytics() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_lead_analytics() TO authenticated, service_role;
