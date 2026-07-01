# Requirements: E2E Runtime Error Guard

## Scope

Harden E2E coverage so unexpected browser runtime errors are surfaced during tests instead of being hidden in dev server logs.

## Requirements

- [REQ-001] WHEN a commercial user uploads an unsupported file type in the simulator, the UI shall show validation feedback without throwing a browser page error.
- [REQ-002] IF React or browser runtime errors occur during any E2E page as `pageerror` events or critical console errors, the E2E test shall fail with the captured error message.
- [REQ-003] The guard shall not treat expected business validation feedback, such as invalid login or invalid file type, as runtime fatal.
- [REQ-004] The guard shall not change production behavior or introduce data mutations.
- [REQ-005] WHEN an admin opens `/dashboard`, the app shall route them to `/admin` without causing a Next/React Router hook-count runtime error.

## Invariants

- The E2E runtime guard remains test-only.
- The simulator invalid-upload test continues to validate visible user feedback.
- No Supabase schema changes are required.
- Admins continue to land on the admin dashboard from `/dashboard`.
