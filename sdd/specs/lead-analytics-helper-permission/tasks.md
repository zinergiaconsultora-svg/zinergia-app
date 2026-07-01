# Tasks: Lead Analytics Helper Permission

## Status

`in_progress`

## Tasks

- [x] 1. Document the permission regression and desired invariant.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`.
- [x] 2. Add a Supabase migration replacing `get_lead_analytics()` with `private.is_admin()`.
  - Traceability: `REQ-001`, `REQ-002`.
- [ ] 3. Validate E2E/admin flow and static gates.
  - Traceability: `REQ-001`, `REQ-003`.
