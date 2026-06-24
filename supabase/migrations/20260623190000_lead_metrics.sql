-- =============================================
-- LEAD METRICS — agregados para el dashboard del cockpit admin
-- =============================================
-- SECURITY INVOKER: respeta la RLS de ocr_jobs (admin ve todo; un comercial solo
-- lo suyo). El acceso real lo gatea la server action (admin-only).

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
        'permanence_due_30',   count(*) FILTER (WHERE closed AND permanence_until IS NOT NULL AND permanence_until <= current_date + 30),
        'funnel', json_build_object(
            'uploaded', count(*),
            'ocr_done', count(*) FILTER (WHERE status = 'completed'),
            'compared', count(*) FILTER (WHERE compared_at IS NOT NULL),
            'won',      count(*) FILTER (WHERE closed)
        )
    )
    FROM public.ocr_jobs;
$$;

CREATE OR REPLACE FUNCTION public.get_lead_agent_ranking()
RETURNS TABLE(agent_id uuid, agent_name text, won bigint, lost bigint, open_leads bigint, commission numeric)
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
    SELECT
        j.agent_id,
        p.full_name,
        count(*) FILTER (WHERE j.closed)                      AS won,
        count(*) FILTER (WHERE j.lost)                        AS lost,
        count(*) FILTER (WHERE NOT j.closed AND NOT j.lost)   AS open_leads,
        coalesce(sum(j.commission_amount) FILTER (WHERE j.closed), 0) AS commission
    FROM public.ocr_jobs j
    LEFT JOIN public.profiles p ON p.id = j.agent_id
    GROUP BY j.agent_id, p.full_name
    ORDER BY count(*) FILTER (WHERE j.closed) DESC, open_leads DESC
    LIMIT 20;
$$;

-- EXECUTE se concede por defecto a PUBLIC y, en Supabase, también directamente a
-- anon/authenticated (default privileges). Revocamos de todos y concedemos solo a
-- authenticated (la acción ya gatea a admin).
REVOKE EXECUTE ON FUNCTION public.get_lead_metrics() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_lead_agent_ranking() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_lead_agent_ranking() TO authenticated;
