-- Target: staging only (dnzytocmtmnptndeczny), 2026-06-30.
-- Purpose: reconcile staging with existing migration
-- supabase/migrations/20260629110053_proposal_price_snapshots.sql while
-- remote migration history prevents `supabase db push`.
-- Rollback: drop these nullable/defaulted columns only if staging is rebuilt.

alter table public.proposals
    add column if not exists source_tariff_id uuid,
    add column if not exists source_proposal_id uuid,
    add column if not exists proposal_version integer not null default 1,
    add column if not exists price_snapshot jsonb not null default '{}'::jsonb,
    add column if not exists price_snapshot_at timestamptz not null default now(),
    add column if not exists pricing_status text not null default 'snapshot',
    add column if not exists repriced_at timestamptz,
    add column if not exists repricing_delta_eur numeric(12,2);
