# Design: E2E Functional Flow Coverage

## Approach

The failing full-suite run exposed test drift rather than a single product defect:

- `/dashboard/profile` is not a list/profile route; profile configuration lives under `/dashboard/settings`.
- `/dashboard/clients` renders the current CRM dashboard shell, but the test only accepted older table/list signals.
- `/dashboard/simulator` now starts with a required segment selection step before the upload input is available.
- Visual snapshot tests created new baselines during the functional run.
- Some accessibility scans used `networkidle`, which is brittle on streaming/dev-server pages.
- Playwright could reuse an unrelated existing `localhost:3000` server, producing false 404 failures.
- The OCR failure test attempted to mock a server-side webhook with `page.route`, which cannot intercept server-side requests.

The fix keeps product code untouched and narrows the E2E suite to user-visible route signals.

## Test Changes

- Update profile coverage to target `/dashboard/settings` and assert the settings heading plus existing profile controls.
- Expand client-list acceptance to include the current "Mis Clientes" heading and search placeholder.
- Add a simulator helper that selects the residential segment before upload assertions.
- Generate temporary PDF/text fixtures via `testInfo.outputPath(...)`.
- Gate visual regression tests behind `RUN_VISUAL_E2E=true`.
- Replace brittle broad waits with route-specific heading/body readiness checks.
- Disable silent local server reuse by default; `PLAYWRIGHT_REUSE_SERVER=true` remains available for an intentional local override.
- Keep the server-side OCR failure scenario out of the default browser suite until there is a controllable test seam.
- Keep the desktop app version available to assistive technology without rendering a low-contrast micro-label over the glass navigation.

## Security

No Supabase schema, RLS, auth, or storage changes are involved. The suite continues to use existing staging credentials from ignored environment files and does not print or commit secrets.
