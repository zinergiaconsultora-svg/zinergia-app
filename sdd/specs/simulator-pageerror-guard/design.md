# Design: Simulator Page Error Guard

## Approach

Add `page.on('pageerror')` and targeted `page.on('console')` listeners to the existing simulator invalid-upload E2E test. The listeners record runtime errors while the test uploads a non-PDF file and waits for visible validation feedback.

At the end of the test, wait briefly for late client-side errors and assert that no runtime errors were captured. This turns hidden browser exceptions into deterministic regressions without changing application code.

## Why This Shape

The full E2E suite emitted a late dev-server browser log mentioning a React hook-count error, but the focused invalid-upload flow did not reproduce a `pageerror` or matching console event on the active page. A test-level guard is the smallest reliable hardening: it preserves current passing behavior and catches the error if it becomes reproducible in this path.

This change does not claim to fix the late dev-server log. It records the current evidence and makes the simulator invalid-upload path stricter while a broader global runtime-error harness remains a separate follow-up.

## Validation

- Run the focused simulator invalid-upload E2E test.
- Run lint.
- Run the full E2E suite if time allows.
