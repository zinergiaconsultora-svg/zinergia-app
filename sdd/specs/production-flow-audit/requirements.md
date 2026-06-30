# Requirements: Production Flow Audit

## Scope

Audit the authenticated operating flow for admin and commercial users, then reinforce automated smoke coverage so regressions in role routing, core navigation, and public proposal handling are caught before deploy.

## Requirements

- [REQ-001] WHEN a commercial user signs in, the system shall land the user on `/dashboard` and expose the commercial operating routes for dashboard, clients, invoices, proposals, simulator, wallet, settings, and tariffs.
- [REQ-002] WHEN an admin user signs in, the system shall land the user on `/admin` and expose the admin control routes for leads, drive, reporting, agents, academy, RGPD, audit, KPIs, and billing/tariff administration.
- [REQ-003] WHEN a non-admin or unauthenticated user attempts to access `/admin`, the system shall prevent access and redirect away from protected admin content.
- [REQ-004] WHEN the smoke suite visits a protected route, the system shall verify a route-specific signal beyond a generic `main` element.
- [REQ-005] WHEN public proposal URLs are invalid, the system shall render a safe not-found state without requiring authentication and without exposing proposal data.
- [REQ-006] IF E2E credentials or optional seeded data are missing, the test suite shall skip dependent checks explicitly instead of failing ambiguously.
- [REQ-007] The audit shall not store credentials, generated auth state, traces, screenshots, or production data in git.
- [REQ-008] The implementation shall not introduce product behavior changes unless a verified defect requires a narrowly scoped follow-up fix.

## Invariants

- No schema migration is required for this feature.
- No Supabase service role key or user password may be committed.
- Tests that can mutate business data must remain staging-only or explicitly skipped without seeded data.
