-- RGPD data retention — purge expired clients
-- Implements the retention policy from docs/rgpd-runbook.md §5:
--   won    clients → 5 years after last update
--   lost / inactive → 12 months after last update
--
-- The function is called by /api/cron/purge-expired-clients (Vercel Cron)
-- once per day. It is idempotent and safe to re-run.

-- ──────────────────────────────────────────────────────────────────────────────
-- Helper: add `reason` column to audit_logs if not present
-- (baseline has action, table_name, record_id — we use `action` for reason)
-- No schema change needed; we encode reason in the `action` field.
-- ──────────────────────────────────────────────────────────────────────────────

-- ──────────────────────────────────────────────────────────────────────────────
-- purge_expired_clients()
-- Returns the count of deleted rows.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.purge_expired_clients()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cutoff_won        timestamptz := now() - interval '5 years';
    v_cutoff_lost       timestamptz := now() - interval '12 months';
    v_deleted_total     integer := 0;
    v_client            record;
BEGIN
    -- Collect clients eligible for purge into a temp table
    CREATE TEMP TABLE _clients_to_purge ON COMMIT DROP AS
    SELECT
        id,
        CASE
            WHEN status = 'won'  THEN 'rgpd_retention_won_5y'
            ELSE                      'rgpd_retention_inactive_12m'
        END AS purge_reason
    FROM public.clients
    WHERE
        (status = 'won'  AND updated_at < v_cutoff_won)
        OR
        (status IN ('lost', 'new', 'contacted', 'in_process')
         AND updated_at < v_cutoff_lost);

    -- Write one audit log entry per client BEFORE deletion
    INSERT INTO public.audit_logs (action, table_name, record_id, new_data)
    SELECT
        p.purge_reason,
        'clients',
        p.id,
        jsonb_build_object(
            'purged_at', now(),
            'reason', p.purge_reason
        )
    FROM _clients_to_purge p;

    -- DELETE (cascades to proposals → network_commissions, ocr_jobs, etc.)
    DELETE FROM public.clients
    WHERE id IN (SELECT id FROM _clients_to_purge);

    GET DIAGNOSTICS v_deleted_total = ROW_COUNT;

    RETURN v_deleted_total;
END;
$$;

-- Grant execution only to service_role (called via API cron, not by users)
REVOKE ALL ON FUNCTION public.purge_expired_clients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_expired_clients() TO service_role;

-- ──────────────────────────────────────────────────────────────────────────────
-- View: clients approaching retention deadline (for /admin/rgpd panel)
-- Returns clients that will be purged within 30 days.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.v_clients_expiring_soon AS
SELECT
    id,
    name,
    email,
    status,
    updated_at,
    CASE
        WHEN status = 'won'
            THEN (updated_at + interval '5 years')::date
        ELSE
            (updated_at + interval '12 months')::date
    END AS purge_date
FROM public.clients
WHERE
    (status = 'won'  AND updated_at > now() - interval '5 years'
                     AND updated_at < now() - interval '5 years' + interval '30 days')
    OR
    (status IN ('lost', 'new', 'contacted', 'in_process')
     AND updated_at > now() - interval '12 months'
     AND updated_at < now() - interval '12 months' + interval '30 days');

-- Admin only
REVOKE ALL ON public.v_clients_expiring_soon FROM PUBLIC;
GRANT SELECT ON public.v_clients_expiring_soon TO authenticated;

-- RLS-equivalent: enforce in API layer (view has no RLS; only admin role
-- reaches the /admin/rgpd endpoint via requireRouteRole).
