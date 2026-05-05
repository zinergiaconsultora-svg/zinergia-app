-- 1. Add monthly_goal column to franchises (idempotent)
DO $$ BEGIN
    ALTER TABLE franchises ADD COLUMN IF NOT EXISTS monthly_goal numeric DEFAULT 10000;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Dashboard stats RPC — replaces multiple client-side queries
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_franchise_id uuid)
RETURNS jsonb AS $$
DECLARE
    v_result jsonb;
    v_goal numeric;
BEGIN
    SELECT COALESCE(monthly_goal, 10000) INTO v_goal
    FROM franchises WHERE id = p_franchise_id;

    SELECT jsonb_build_object(
        'total_detected', COALESCE(SUM(CASE WHEN p.status IN ('draft','sent','accepted') THEN p.current_annual_cost ELSE 0 END), 0),
        'secured', COALESCE(SUM(CASE WHEN p.status = 'accepted' THEN p.annual_savings ELSE 0 END), 0),
        'pipeline', COALESCE(SUM(CASE WHEN p.status IN ('draft','sent') THEN p.annual_savings ELSE 0 END), 0),
        'accepted_count', COUNT(CASE WHEN p.status = 'accepted' THEN 1 END),
        'total_count', COUNT(*),
        'month_savings', COALESCE(SUM(CASE WHEN p.status = 'accepted' AND p.created_at >= date_trunc('month', now()) THEN p.annual_savings ELSE 0 END), 0),
        'monthly_goal', v_goal,
        'conversion_rate', CASE WHEN COUNT(*) > 0 THEN ROUND(COUNT(CASE WHEN p.status = 'accepted' THEN 1 END)::numeric / COUNT(*)::numeric * 100, 1) ELSE 0 END,
        'recent_proposals', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'id', rp.id,
                'annual_savings', rp.annual_savings,
                'status', rp.status,
                'created_at', rp.created_at,
                'client_name', COALESCE(c.name, 'Sin nombre')
            ) ORDER BY rp.created_at DESC)
            FROM proposals rp
            LEFT JOIN clients c ON c.id = rp.client_id
            WHERE rp.franchise_id = p_franchise_id
            ORDER BY rp.created_at DESC
            LIMIT 5),
            '[]'::jsonb
        ),
        'savings_trend', COALESCE(
            (SELECT jsonb_agg(jsonb_build_object(
                'name', to_char(m.month, 'Mon YYYY'),
                'value', m.savings
            ) ORDER BY m.month)
            FROM (
                SELECT date_trunc('month', created_at) AS month, SUM(annual_savings) AS savings
                FROM proposals
                WHERE franchise_id = p_franchise_id AND status = 'accepted'
                  AND created_at >= date_trunc('month', now()) - interval '6 months'
                GROUP BY 1
            ) m),
            '[]'::jsonb
        )
    ) INTO v_result
    FROM proposals p
    WHERE p.franchise_id = p_franchise_id;

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
