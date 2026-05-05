# Legacy SQL Scripts

These files are historical one-off setup, repair, and pre-baseline scripts.

Do not apply them to Supabase environments as migrations. The reproducible
schema source of truth is `supabase/migrations/`, starting with
`20260420_baseline.sql` plus later migration files.

If any legacy script is still needed for a one-off data repair, copy its content
into a new timestamped script under `supabase/scripts/` and document the target
environment, operator, date, and rollback plan before running it.
