# Renewal Alert Audit Event Tasks

Feature: `renewal-alert-audit-event`

- [x] 1. Add SDD requirements and design for renewal alert auditing.
  - Traceability: Implements `REQ-001` through `REQ-005`.
- [x] 2. Add migration support for `renewal_alert` and 60-day analytics.
  - Traceability: Implements `REQ-003`, `REQ-005`, `INV-001`.
- [x] 3. Update the permanence reminder cron to use 60 days and write `renewal_alert`.
  - Traceability: Implements `REQ-001`, `REQ-002`, `INV-003`.
- [x] 4. Align admin queue labels, empty copy, KPI naming, and filter window.
  - Traceability: Implements `REQ-003`, `REQ-004`, `INV-002`.
- [x] 5. Add focused tests and run quality gates.
  - Traceability: Verifies all requirements.
