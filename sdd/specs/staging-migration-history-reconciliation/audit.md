# Audit - Staging Migration History Reconciliation

Feature: `staging-migration-history-reconciliation`

Date: 2026-07-01

Status: `done`

## Summary

The repo has a complete local migration source under `supabase/migrations/`. Staging migration history was reconciled on 2026-07-01 and the pending local migrations were applied to staging.

After PR #61 was merged, production history was reconciled with the same controlled process: remote-only missing-source versions were reverted, already-materialized local versions were marked applied after a read-only schema check, and only the new trigger fix migration was pushed.

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

## Production Reconciliation

Target:

- Project ref: `gmjgkzaxmkaggsyczwcm`
- Project name: `proyectozinergia`

Production initially had remote-only history rows that were not represented in `supabase/migrations/`. They were removed from production history with `npx supabase migration repair --status reverted ... --linked`.

After that repair, production still had local-only versions from `20260616090000` through `20260626220000` because later `20260629...` migrations were already present remotely. A read-only schema check verified the expected columns, tables and functions from those intermediate migrations existed, so the following versions were marked applied rather than re-running potentially destructive SQL:

```text
20260616090000 20260616120000 20260617120000 20260623120000 20260623140000
20260623150000 20260623160000 20260623170000 20260623180000 20260623190000
20260624100347 20260624140000 20260624150000 20260624160000 20260625000000
20260625100000 20260626000000 20260626100000 20260626200000 20260626210000
20260626220000
```

Then `npx supabase db push --dry-run --linked` listed only:

```text
20260630230425_fix_auto_switch_event_marketer.sql
```

That migration was applied to production with `npx supabase db push --linked`.

Final production verification:

- `npx supabase db push --dry-run --linked` returned `Remote database is up to date.`

## Security Notes

- Do not paste Supabase access tokens in chat.
- Any token pasted in chat should be revoked and replaced.
- Do not commit `.env.staging.local`.
- Run production `migration repair` only after a read-only schema check proves the affected local migrations are already materialized.
