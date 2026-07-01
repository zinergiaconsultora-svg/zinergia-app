# Design - Staging Migration History Reconciliation

Feature: `staging-migration-history-reconciliation`

Status: `approved`

## Approach

Use the Supabase CLI and direct read-only history queries to separate two problems:

1. Migration history drift: remote versions in `supabase_migrations.schema_migrations` that do not exist under `supabase/migrations`.
2. Schema drift: columns/policies/indexes missing even after history is aligned.

The safe repair path is conservative:

- Audit linked and staging.
- Do not mutate production/linked.
- For staging only, mark remote-only legacy versions as `reverted` if their effects are covered by the repo baseline or archived pre-baseline files.
- Keep staging-only operational reconciliation scripts in `supabase/scripts/`.
- Verify `migration list` and `db push --dry-run`.

## Tooling

- `npx supabase migration list --linked` for the linked project.
- `npx supabase migration list --db-url <staging>` for staging.
- `npx supabase db push --dry-run --db-url <staging>` for post-repair validation.
- `npx supabase migration repair <version> --status reverted --db-url <staging>` only after audit classification.

## Risk Controls

- Production is read-only.
- Staging DB URL is built from `.env.staging.local` at runtime; secrets are never written to tracked files.
- All outputs committed are redacted summaries or scripts without credentials.

## Verification

- SDD validator.
- Staging `migration list` after repair.
- Staging `db push --dry-run` after repair.
- Existing E2E seed/mutable smoke if schema changes were involved.
