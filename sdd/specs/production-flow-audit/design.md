# Design: Production Flow Audit

## Summary

Strengthen the existing Playwright suite around role-specific journeys. The current coverage proves pages render, but many checks accept any visible `main`, which misses broken navigation labels, wrong route exposure, or route-specific loading failures.

## Approach

- Keep using the existing `playwright.config.ts` projects:
  - `chromium` uses commercial/agent storage state.
  - `chromium-admin` runs `admin.spec.ts` with admin storage state.
- Reuse `e2e/global.setup.ts` and environment-based credentials.
- Avoid committing credentials or `.auth` output.
- Add route-specific assertions to existing specs instead of introducing a new project mapping.

## Commercial Flow Checks

- `/dashboard` renders dashboard-specific copy and commercial navigation.
- Commercial routes render route-specific signals:
  - `/dashboard/clients`
  - `/dashboard/invoices`
  - `/dashboard/proposals`
  - `/dashboard/simulator`
  - `/dashboard/wallet`
  - `/dashboard/settings`
  - `/dashboard/tariffs`
- Admin-only controls must not be exposed in the commercial navigation.

## Admin Flow Checks

- `/dashboard` redirects admin users to `/admin`.
- `/admin` renders global-system/admin-specific copy and admin navigation.
- Admin routes render route-specific signals:
  - `/admin/leads`
  - `/admin/drive`
  - `/admin/reporting`
  - `/admin/agents`
  - `/admin/academy`
  - `/admin/rgpd`
  - `/admin/audit`
  - `/admin/business-metrics`
- Unauthenticated access to `/admin` redirects to login.

## Public Flow Checks

- Existing public proposal tests continue to verify invalid tokens and optional seeded valid tokens.
- This feature does not accept real proposals or mutate proposal statuses.

## Verification

- `node sdd/scripts/validate-sdd.mjs`
- `npm run test:e2e -- dashboard.spec.ts admin.spec.ts proposal-public.spec.ts`
- `npm run lint`
- `npx tsc --noEmit`
