# SIPS Cache Error Hardening Tasks

Feature: `sips-cache-error-hardening`

- [x] 1. Add SDD requirements and design for SIPS cache/error hardening.
  - Traceability: Implements `REQ-001` through `REQ-005`.
- [x] 2. Change SIPS cache reads and writes to respect a 7-day `expires_at` TTL.
  - Traceability: Implements `REQ-001`, `REQ-002`.
- [x] 3. Add a migration to update the cache default and cap existing rows.
  - Traceability: Implements `REQ-005`.
- [x] 4. Sanitize client-facing SIPS error responses while preserving server audit.
  - Traceability: Implements `REQ-003`, `REQ-004`, `INV-001`.
- [x] 5. Add focused tests and run quality gates.
  - Traceability: Verifies all requirements.
