-- ============================================================
-- MIGRACIÓN: RPC get_dashboard_stats — agrega KPIs en Postgres
-- Ejecutar una vez en Supabase SQL Editor.
-- ============================================================
-- Reemplaza el fetch de todas las proposals en dashboard.ts con un único
-- viaje de red que devuelve un objeto JSON pre-ensamblado en la BD.
-- Reducción estimada: N rows × row_size → ~2KB JSON, independiente del volumen.

CREATE OR REPLACE FUNCTION get_dashboard_stats(p_franchise_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
AS $$
DECLARE
  v_now         timestamptz := NOW();
  v_month_start timestamptz := DATE_TRUNC('month', NOW());
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      -- Financials (single pass over proposals)
      'total_detected',    COALESCE(SUM(annual_savings), 0),
      'secured',           COALESCE(SUM(annual_savings) FILTER (WHERE status = 'accepted'), 0),
      'pipeline',          COALESCE(SUM(annual_savings) FILTER (WHERE status IN ('sent', 'draft')), 0),
      'accepted_count',    COUNT(*) FILTER (WHERE status = 'accepted'),
      'total_count',       COUNT(*),
      'month_savings',     COALESCE(SUM(annual_savings) FILTER (WHERE created_at >= v_month_start), 0),
      'conversion_rate',   CASE WHEN COUNT(*) > 0
                                THEN ROUND((COUNT(*) FILTER (WHERE status = 'accepted'))::numeric / COUNT(*) * 100)
                                ELSE 0 END,

      -- Recent proposals (top 5, latest first)
      'recent_proposals', (
        SELECT COALESCE(jsonb_agg(r ORDER BY r.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT p2.id,
                 p2.annual_savings,
                 p2.status,
                 p2.created_at,
                 COALESCE(c.name, 'Cliente') AS client_name
          FROM   proposals p2
          LEFT JOIN clients c ON c.id = p2.client_id
          WHERE  p2.franchise_id = p_franchise_id
          ORDER  BY p2.created_at DESC
          LIMIT  5
        ) r
      ),

      -- Savings trend: last 7 months, one row per month
      'savings_trend', (
        SELECT COALESCE(jsonb_agg(
          jsonb_build_object('name', month_name, 'value', total_savings)
          ORDER BY month_start
        ), '[]'::jsonb)
        FROM (
          SELECT DATE_TRUNC('month', created_at) AS month_start,
                 TO_CHAR(DATE_TRUNC('month', created_at), 'Mon')   AS month_name,
                 COALESCE(SUM(annual_savings), 0)                  AS total_savings
          FROM   proposals
          WHERE  franchise_id = p_franchise_id
            AND  created_at >= DATE_TRUNC('month', NOW() - INTERVAL '6 months')
          GROUP  BY 1, 2
        ) t
      )
    )
    FROM proposals
    WHERE franchise_id = p_franchise_id
  );
END;
$$;

-- Permisos: solo usuarios autenticados pueden ejecutar la función
GRANT EXECUTE ON FUNCTION get_dashboard_stats(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION get_dashboard_stats(uuid) FROM anon;
