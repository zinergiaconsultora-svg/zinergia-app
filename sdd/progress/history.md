# SDD History

## 2026-06-30 — public-proposal-acceptance-security

Status: done.

Implemented:

- Narrowed the public proposal response so public reads no longer select `calculation_data`, internal ids or `public_token`.
- Added a narrow `PublicProposal` type for the public page.
- Required server-side signer name and PNG signature payload before service-role acceptance work.
- Normalized invalid public acceptance token errors to a generic safe message.
- Made the acceptance update conditional on `status = 'sent'` and `public_accepted_at IS NULL`.
- Added idempotent already-accepted handling when the conditional update does not write.
- Limited public acceptance activity metadata to safe fields: `proposal_id`, `source`, `accepted_at`.
- Added focused tests for public proposal read/acceptance behavior.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run test -- publicProposal` — 1 file passed, 7 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with 6 existing warnings in unrelated files.
- `npm run test` — 49 files passed, 357 tests passed.
- `npm run build` — passed.

Residual notes:

- No schema migration was needed.
- Browser/manual E2E was not run because this change was covered by focused action tests and production build.

## 2026-06-30 — commission-split-hardening

Status: done.

Implemented:

- Added shared pure resolver `resolveCommissionAmounts(...)` in `src/lib/commissions/calculator.ts`.
- Covered fixed tariff commission, savings fallback, franchise royalty, rounding and invalid negative input in unit tests.
- Refactored public proposal acceptance to use the shared resolver.
- Refactored authenticated proposal acceptance to use the shared resolver.
- Preserved idempotent `network_commissions` persistence via `onConflict: 'proposal_id'`.
- Preserved existing gamification points behavior in authenticated proposal acceptance.
- No schema migration was required because `network_commissions.proposal_id` already has a unique constraint in the baseline.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run test -- calculator` — 1 file passed, 38 tests passed.
- `npm run test -- publicProposal` — 1 file passed, 7 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with 6 existing warnings in unrelated files.
- `npm run test` — 49 files passed, 365 tests passed.
- `npm run build` — passed.

Residual notes:

- Authenticated dashboard acceptance still uses the current authenticated user as `network_commissions.agent_id`. The design preserved this existing behavior, but it may deserve a future business review for admin/franchise accepting on behalf of an agent.

## 2026-06-30 — ocr-to-proposal-flow

Status: done.

Implemented:

- Added migration `supabase/migrations/20260630131500_proposal_ocr_job_provenance.sql`.
- Added nullable `proposals.ocr_job_id` with FK to `ocr_jobs(id) ON DELETE SET NULL`.
- Added partial index `idx_proposals_ocr_job_id`.
- Updated local Supabase and CRM types with `ocr_job_id`.
- Persisted real UUID OCR job provenance in `proposalService.logSimulation(...)`.
- Kept `ocr_jobs.client_id` and `compared_at` linking behavior.
- Propagated `ocr_job_id` to secondary simulator proposals.
- Prevented mock job ids like `MOCK-JOB` from being persisted or linked.
- Added tests for proposal OCR provenance.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run test -- proposals.test` — 1 file passed, 2 tests passed.
- `npm run test -- publicProposal` — 1 file passed, 7 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with 6 existing warnings in unrelated files.
- `npm run test` — 50 files passed, 367 tests passed.
- `npm run build` — passed.

Residual notes:

- `SUPABASE_ACCESS_TOKEN` was not available in the shell, so `src/types/database.types.ts` was updated locally for the new field instead of regenerated from the remote project.
- `npx supabase db push` was not run from this session; apply the migration in the normal Supabase workflow before deploy.
