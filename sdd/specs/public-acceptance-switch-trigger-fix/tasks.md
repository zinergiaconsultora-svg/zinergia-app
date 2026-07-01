# Tasks - Public Acceptance Switch Trigger Fix

Feature: `public-acceptance-switch-trigger-fix`

Status: `done`

- [x] 1. Reproduce and identify the root cause from the failing E2E.
  - Traceability: `REQ-001`.
- [x] 2. Add a Supabase migration that replaces `auto_log_switch_event()`.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `INV-001`.
- [x] 3. Apply the migration to staging and verify dry-run state.
  - Traceability: `REQ-004`, `INV-002`.
- [x] 4. Re-run the mutating public proposal E2E.
  - Traceability: `REQ-004`.
- [x] 5. Update SDD history and final verification notes.
  - Traceability: `INV-001`, `INV-002`.
