# Requirements: Simulator Page Error Guard

## Scope

Harden the simulator E2E coverage so unexpected browser runtime errors are surfaced during the invalid-upload path instead of being hidden in dev server logs.

## Requirements

- [REQ-001] WHEN a commercial user uploads an unsupported file type in the simulator, the UI shall show validation feedback without throwing a browser page error.
- [REQ-002] IF React or browser runtime errors occur during the invalid-upload path as `pageerror` events or critical console errors, the E2E test shall fail with the captured error message.
- [REQ-003] The guard shall not change production behavior or introduce data mutations.

## Invariants

- The invalid-upload test remains staging/local only.
- The test continues to validate visible user feedback.
- No Supabase schema changes are required.
