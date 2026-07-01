# Audit - Staging Migration History Reconciliation

Feature: `staging-migration-history-reconciliation`

Date: 2026-07-01

Status: `done`

## Summary

The repo has a complete local migration source under `supabase/migrations/`. Staging migration history was reconciled on 2026-07-01 and the pending local migrations were applied to staging.

No production migration history was mutated. After staging verification, the repo was linked back to production (`gmjgkzaxmkaggsyczwcm`).

## Local Source Of Truth

- Local migration directory: `supabase/migrations/`
- Local migration files captured: 52
- Archived pre-baseline migrations remain under `supabase/migrations/_archive/` and are not reapplied.
- The baseline migration remains the production schema source of truth as of 2026-04-20.

## Staging Target

- Project ref: `dnzytocmtmnptndeczny`
- Project URL host from `.env.staging.local`: `dnzytocmtmnptndeczny.supabase.co`
- Staging DB password variable present: `STAGING_DB_PASSWORD`

## Access Findings

- Initial direct `--db-url` attempts failed because the staging database password was unavailable/empty.
- The user restored a valid Supabase CLI session and linked the repo to staging with `npx supabase link --project-ref dnzytocmtmnptndeczny`.
- `npx supabase migration list --linked` then connected successfully.

The successful path was project linking via the Supabase CLI, not hand-built DB URLs.

## Repaired Remote-Only Versions

The staging dry run reported these remote migration versions not found locally:

```text
20260616195058 20260623060817 20260623061711 20260623113455 20260623113623
20260623120716 20260623120946 20260623150931 20260623162950 20260623163555
20260623200624 20260624045416 20260624103844 20260624111933 20260624113403
20260624114721 20260626121444 20260626122939 20260626123531 20260626123613
20260626124345 20260626124433 20260626125021 20260626125140
```

Classification: `staging-only missing-source`. They were not represented by current local migration filenames. They were removed from staging history with `npx supabase migration repair --status reverted ... --linked`.

## Applied Local Migrations

After remote-only history repair, `npx supabase db push --dry-run --linked` listed local migrations from `20260616120000_client_segment.sql` through `20260630131500_proposal_ocr_job_provenance.sql`.

The migrations were applied to staging with `npx supabase db push --linked`.

During the push, staging had a few pre-existing objects. These were resolved by removing stale staging-only objects and re-running the same migration push:

- `DROP VIEW IF EXISTS public.invoice_registry;`
- `DROP POLICY IF EXISTS "ocr_invoices_insert_own" ON storage.objects;`
- `DROP POLICY IF EXISTS "ocr_invoices_select_own" ON storage.objects;`
- `DROP POLICY IF EXISTS "ocr_invoices_update_own" ON storage.objects;`
- `DROP POLICY IF EXISTS "ocr_invoices_delete_own" ON storage.objects;`
- `DROP POLICY IF EXISTS "public_proposal_read" ON public.proposals;`
- `DROP POLICY IF EXISTS "public_proposal_update" ON public.proposals;`
- `DROP POLICY IF EXISTS "public_proposal_accept" ON public.proposals;`

## Verification

- `npx supabase migration list --linked` showed local and remote aligned through `20260630131500`.
- `npx supabase db push --dry-run --linked` returned `Remote database is up to date.`
- The repo was relinked back to production with `npx supabase link --project-ref gmjgkzaxmkaggsyczwcm`.

## Security Notes

- Do not paste Supabase access tokens in chat.
- Any token pasted in chat should be revoked and replaced.
- Do not commit `.env.staging.local`.
- Do not run `migration repair` against production in this feature.
