-- OCR Pipeline reliability hardening
-- Two operational fixes that don't require app code changes:
--   1. Ensure `ocr_jobs` is in the `supabase_realtime` publication so
--      postgres_changes events fire for any client that listens to it
--      (OcrJobsPanel uses this; the simulator hook has its own broadcast path).
--   2. Periodic cleanup of jobs that got stuck in `processing` because the
--      browser was closed before the 5-minute client-side timeout could
--      mark them failed. Without this, hung jobs accumulate forever.

-- ── 1. Realtime publication ───────────────────────────────────────────────
-- Idempotent: only adds the table if it isn't already in the publication.
do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename  = 'ocr_jobs'
    ) then
        alter publication supabase_realtime add table public.ocr_jobs;
    end if;
end $$;


-- ── 2. pg_cron cleanup of hung jobs ───────────────────────────────────────
-- Requires the `pg_cron` extension. On Supabase it's available on all plans
-- but must be enabled. `create extension if not exists` is idempotent.
create extension if not exists pg_cron;

-- Schedule (or replace) the cleanup job. Runs every 5 minutes and marks any
-- `processing` job older than 10 minutes as failed.
-- 10 min > 5 min client-side timeout, so we don't race the simulator's own
-- safety net for active sessions — only abandoned jobs are caught here.
do $$
declare
    existing_jobid bigint;
begin
    select jobid into existing_jobid
    from cron.job
    where jobname = 'ocr_jobs_cleanup_hung';

    if existing_jobid is not null then
        perform cron.unschedule(existing_jobid);
    end if;

    perform cron.schedule(
        'ocr_jobs_cleanup_hung',
        '*/5 * * * *',
        $cmd$
            update public.ocr_jobs
            set status        = 'failed',
                error_message = coalesce(
                    error_message,
                    'Server timeout: no callback received within 10 minutes'
                ),
                updated_at    = now()
            where status      = 'processing'
              and created_at  < now() - interval '10 minutes';
        $cmd$
    );
end $$;
