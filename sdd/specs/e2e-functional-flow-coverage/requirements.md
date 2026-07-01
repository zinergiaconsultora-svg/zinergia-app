# Requirements: E2E Functional Flow Coverage

## Scope

Align the staging E2E suite with the current commercial application routes and keep the normal functional smoke run deterministic. This iteration does not change product behavior or database schema.

## Requirements

- [REQ-001] WHEN the authenticated commercial E2E suite visits profile/settings functionality, the system shall verify the real `/dashboard/settings` route instead of a nonexistent `/dashboard/profile` route.
- [REQ-002] WHEN the client list route renders, the suite shall accept the current CRM shell signals, including the page heading and search input, not only legacy table/list markup.
- [REQ-003] WHEN the simulator upload flow is tested, the suite shall complete the mandatory client-segment step before asserting upload controls.
- [REQ-004] WHEN file fixtures are needed by E2E tests, the suite shall write them to Playwright test output paths rather than the source tree.
- [REQ-005] WHEN visual regression snapshots are not explicitly requested, the functional E2E suite shall skip visual snapshot assertions.
- [REQ-006] WHEN accessibility tests scan pages that may navigate or stream, the suite shall wait for stable route-specific UI signals instead of relying on broad `networkidle` waits.
- [REQ-007] WHEN the E2E suite starts locally, it shall not silently reuse an unrelated server on the same port.

## Invariants

- No schema migration is required.
- No credentials, auth state, screenshots, traces, or runtime fixtures may be committed.
- Production-like checks remain read-only unless a test is explicitly staging-only.
