BEGIN;

CREATE OR REPLACE FUNCTION public.get_conversion_funnel(p_agent_id uuid DEFAULT NULL)
RETURNS TABLE (
    status text,
    count bigint,
    percentage numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_franchise_id uuid;
BEGIN
    IF p_agent_id IS NULL THEN
        SELECT profile.franchise_id INTO v_franchise_id
        FROM public.profiles profile
        WHERE profile.id = auth.uid();
    END IF;

    RETURN QUERY
    WITH funnel_counts AS (
        SELECT client.status AS client_status, count(*) AS client_count
        FROM public.clients client
        WHERE (
            p_agent_id IS NULL
            AND (
                (v_franchise_id IS NOT NULL AND client.franchise_id = v_franchise_id)
                OR (v_franchise_id IS NULL AND client.owner_id = auth.uid())
            )
        ) OR (p_agent_id IS NOT NULL AND client.owner_id = p_agent_id)
        GROUP BY client.status
    )
    SELECT
        funnel.client_status,
        funnel.client_count,
        CASE
            WHEN sum(funnel.client_count) OVER () > 0
                THEN round(funnel.client_count::numeric / sum(funnel.client_count) OVER () * 100, 1)
            ELSE 0
        END
    FROM funnel_counts funnel
    ORDER BY array_position(ARRAY['new','contacted','in_process','won','lost'], funnel.client_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_stats(p_franchise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_result jsonb;
    v_goal numeric;
BEGIN
    SELECT coalesce((
        SELECT franchise.monthly_goal
        FROM public.franchises franchise
        WHERE franchise.id = p_franchise_id
    ), 10000) INTO v_goal;

    SELECT jsonb_build_object(
        'total_detected', coalesce(sum(proposal.current_annual_cost)
            FILTER (WHERE proposal.status IN ('draft','sent','accepted')), 0),
        'secured', coalesce(sum(proposal.annual_savings)
            FILTER (WHERE proposal.status = 'accepted'), 0),
        'pipeline', coalesce(sum(proposal.annual_savings)
            FILTER (WHERE proposal.status IN ('draft','sent')), 0),
        'accepted_count', count(*) FILTER (WHERE proposal.status = 'accepted'),
        'total_count', count(*),
        'month_savings', coalesce(sum(proposal.annual_savings)
            FILTER (WHERE proposal.status = 'accepted'
                AND proposal.created_at >= date_trunc('month', now())), 0),
        'monthly_goal', v_goal,
        'conversion_rate', CASE
            WHEN count(*) > 0 THEN round(
                (count(*) FILTER (WHERE proposal.status = 'accepted'))::numeric
                / count(*)::numeric * 100,
                1
            )
            ELSE 0
        END,
        'recent_proposals', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'id', recent.id,
                'annual_savings', recent.annual_savings,
                'status', recent.status,
                'created_at', recent.created_at,
                'client_name', recent.client_name
            ) ORDER BY recent.created_at DESC)
            FROM (
                SELECT
                    recent_proposal.id,
                    recent_proposal.annual_savings,
                    recent_proposal.status,
                    recent_proposal.created_at,
                    coalesce(client.name, 'Sin nombre') AS client_name
                FROM public.proposals recent_proposal
                LEFT JOIN public.clients client ON client.id = recent_proposal.client_id
                WHERE recent_proposal.franchise_id = p_franchise_id
                ORDER BY recent_proposal.created_at DESC
                LIMIT 5
            ) recent
        ), '[]'::jsonb),
        'savings_trend', coalesce((
            SELECT jsonb_agg(jsonb_build_object(
                'name', to_char(monthly.month, 'Mon YYYY'),
                'value', monthly.savings
            ) ORDER BY monthly.month)
            FROM (
                SELECT
                    date_trunc('month', trend_proposal.created_at) AS month,
                    sum(trend_proposal.annual_savings) AS savings
                FROM public.proposals trend_proposal
                WHERE trend_proposal.franchise_id = p_franchise_id
                  AND trend_proposal.status = 'accepted'
                  AND trend_proposal.created_at >= date_trunc('month', now()) - interval '6 months'
                GROUP BY 1
            ) monthly
        ), '[]'::jsonb)
    ) INTO v_result
    FROM public.proposals proposal
    WHERE proposal.franchise_id = p_franchise_id;

    RETURN v_result;
END;
$$;

ALTER FUNCTION public.get_monthly_metrics(integer) SECURITY INVOKER;
ALTER FUNCTION public.get_expiring_contracts(integer) SECURITY INVOKER;
ALTER FUNCTION public.get_withdrawal_growth(uuid) SECURITY INVOKER;
ALTER FUNCTION public.guard_lead_state_transition() SET search_path = public;

CREATE OR REPLACE FUNCTION public.purge_expired_clients()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff_won timestamptz := now() - interval '5 years';
    v_cutoff_lost timestamptz := now() - interval '12 months';
    v_deleted_total integer := 0;
BEGIN
    WITH clients_to_purge AS MATERIALIZED (
        SELECT
            client.id,
            CASE
                WHEN client.status = 'won' THEN 'rgpd_retention_won_5y'
                ELSE 'rgpd_retention_inactive_12m'
            END AS purge_reason
        FROM public.clients client
        WHERE (client.status = 'won' AND client.updated_at < v_cutoff_won)
           OR (
               client.status IN ('lost', 'new', 'contacted', 'in_process')
               AND client.updated_at < v_cutoff_lost
           )
    ),
    audit_rows AS (
        INSERT INTO public.audit_logs (action, table_name, record_id, new_data)
        SELECT
            candidate.purge_reason,
            'clients',
            candidate.id,
            jsonb_build_object(
                'purged_at', now(),
                'reason', candidate.purge_reason
            )
        FROM clients_to_purge candidate
        RETURNING record_id
    ),
    deleted_rows AS (
        DELETE FROM public.clients client
        USING audit_rows audit
        WHERE client.id = audit.record_id
        RETURNING client.id
    )
    SELECT count(*)::integer INTO v_deleted_total FROM deleted_rows;

    RETURN v_deleted_total;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_conversion_funnel(uuid),
    public.get_dashboard_stats(uuid), public.get_monthly_metrics(integer),
    public.get_expiring_contracts(integer), public.get_withdrawal_growth(uuid)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_conversion_funnel(uuid),
    public.get_dashboard_stats(uuid), public.get_monthly_metrics(integer),
    public.get_expiring_contracts(integer), public.get_withdrawal_growth(uuid)
TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.purge_expired_clients() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_expired_clients() TO service_role;

COMMIT;
