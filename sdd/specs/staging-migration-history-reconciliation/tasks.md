# Tasks - Staging Migration History Reconciliation

Feature: `staging-migration-history-reconciliation`

Status: `done`

- [x] 1. Capture local, linked and staging migration histories.
  - Traceability: `REQ-001`, `INV-001`, `INV-002`.
- [x] 2. Classify remote-only staging versions and define the repair set.
  - Traceability: `REQ-002`, `REQ-003`.
- [x] 3. Apply staging-only migration history repair if the repair set is safe.
  - Traceability: `REQ-003`, `REQ-004`.
- [x] 4. Verify staging `migration list` and `db push --dry-run`.
  - Traceability: `REQ-004`, `REQ-005`, `REQ-006`.
- [x] 5. Document the reconciliation procedure and residual drift.
  - Traceability: `REQ-006`, `REQ-007`, `INV-003`.

## Current Notes

- 2026-07-01: local migration source captured.
- 2026-07-01: linked/production history remained read-only; no mutation attempted.
- 2026-07-01: staging repair is blocked in this Codex shell by missing Zinergia Supabase management context and failing direct Postgres authentication. See `audit.md`.
- 2026-07-01: user restored a valid Supabase session, linked staging, repaired remote-only staging history, pushed pending local migrations to staging, verified `Remote database is up to date`, then relinked the repo back to production.
