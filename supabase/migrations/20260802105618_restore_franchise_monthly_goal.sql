BEGIN;

-- Production drifted despite 20260428093000 being present in migration
-- history. Restore the column expected by get_dashboard_stats idempotently.
ALTER TABLE public.franchises
    ADD COLUMN IF NOT EXISTS monthly_goal numeric DEFAULT 10000;

COMMENT ON COLUMN public.franchises.monthly_goal IS
    'Monthly commercial target used by the franchise dashboard.';

COMMIT;
