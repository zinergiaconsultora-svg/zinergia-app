-- Target: staging only (dnzytocmtmnptndeczny), 2026-06-30.
-- Purpose: reconcile staging with existing migration
-- supabase/migrations/20260630131500_proposal_ocr_job_provenance.sql while
-- remote migration history prevents `supabase db push`.
-- Rollback: drop this nullable column only if staging is rebuilt.

alter table public.proposals
    add column if not exists ocr_job_id uuid;
