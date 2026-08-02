BEGIN;

-- Vercel Cron is the sole scheduler for this endpoint. Remove the historical
-- pg_cron duplicate and its embedded authorization header from both projects.
DO $$
BEGIN
    IF to_regclass('cron.job') IS NOT NULL THEN
        PERFORM cron.unschedule(job.jobid)
        FROM cron.job job
        WHERE job.jobname = 'proposal-followup-daily';
    END IF;
END;
$$;

COMMIT;
