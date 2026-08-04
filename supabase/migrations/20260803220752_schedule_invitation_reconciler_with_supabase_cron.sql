-- ZIN-SDD-041: move the five-minute invitation reconciler from Vercel Cron
-- to Supabase Cron + Edge Functions. The endpoint URL and bearer secret are kept in Vault and
-- resolved at execution time so cron.job never contains either secret.
--
-- Operators must provision these Vault secrets before this migration:
--   zinergia_reconcile_cron_url
--   zinergia_reconcile_cron_secret
--   zinergia_reconcile_cron_enabled ("false" in staging, "true" in production)

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

BEGIN;

DO $$
DECLARE
    v_url text;
    v_secret text;
    v_enabled text;
    v_existing_job_id bigint;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron')
       OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net')
       OR NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'supabase_vault') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'RECONCILER_CRON_DEPENDENCY_MISSING';
    END IF;

    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets
    WHERE name = 'zinergia_reconcile_cron_url';

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'zinergia_reconcile_cron_secret';

    SELECT decrypted_secret INTO v_enabled
    FROM vault.decrypted_secrets
    WHERE name = 'zinergia_reconcile_cron_enabled';

    IF v_url IS NULL
       OR v_url !~ '^https://[^[:space:]]+\.supabase\.co/functions/v1/reconcile-invitation-provisioning$'
       OR v_secret IS NULL
       OR length(v_secret) < 16
       OR v_enabled NOT IN ('true', 'false') THEN
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'RECONCILER_CRON_VAULT_SECRET_INVALID';
    END IF;

    SELECT jobid INTO v_existing_job_id
    FROM cron.job
    WHERE jobname = 'zinergia-reconcile-invitation-provisioning';

    IF v_existing_job_id IS NOT NULL THEN
        PERFORM cron.unschedule(v_existing_job_id);
    END IF;

    PERFORM cron.schedule(
        'zinergia-reconcile-invitation-provisioning',
        '*/5 * * * *',
        $command$
            SELECT net.http_get(
                url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'zinergia_reconcile_cron_url'),
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'zinergia_reconcile_cron_secret')
                ),
                timeout_milliseconds := 10000
            )
            FROM vault.decrypted_secrets AS enabled
            WHERE enabled.name = 'zinergia_reconcile_cron_enabled'
              AND enabled.decrypted_secret = 'true';
        $command$
    );
END;
$$;

COMMIT;
