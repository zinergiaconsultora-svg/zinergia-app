# Design: E2E Runtime Error Guard

## Approach

Add a shared Playwright fixture under `e2e/fixtures/runtime.ts`. Specs import `test` and `expect` from this fixture instead of directly from `@playwright/test`.

For every test page, the fixture records:

- `pageerror` events, which represent uncaught browser exceptions.
- Targeted fatal console errors matching React/runtime signatures such as hook-count errors or invalid hook calls.

At the end of each test, the fixture waits briefly for late client-side errors and asserts that no runtime errors were captured.

The runtime guard made the existing admin redirect test fail reliably. The failing path is `/dashboard` for an authenticated admin: `DashboardPage` used Next's server `redirect('/admin')`, and in local App Router dev mode this produced a Router-level hook-count error during the transition. Direct `/admin` navigation was clean.

For that exact admin landing path, replace the internal App Router redirect with a small client document redirect component that calls `window.location.replace('/admin')`. This preserves the user-facing route outcome while avoiding the unstable client router transition.

## Why This Shape

The full E2E suite emitted a late dev-server browser log mentioning a React hook-count error, but the focused invalid-upload flow did not reproduce a `pageerror` or matching console event on the active page. A shared fixture is the next smallest reliable hardening: it catches browser runtime errors from any active E2E page while leaving expected domain validation errors alone.

This change does not claim to fix logs that only appear after page teardown in the Next dev server. It records the current evidence and makes active browser runtime failures deterministic.

## Validation

- Run the focused simulator invalid-upload E2E test.
- Run the focused admin `/dashboard` redirect E2E test.
- Run the full staging E2E suite.
- Run lint.
