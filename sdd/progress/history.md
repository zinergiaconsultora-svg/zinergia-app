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

## 2026-06-30 — ci-warning-cleanup

Status: done.

Implemented:

- Added `router` to the `OcrJobsPanel` realtime effect dependencies.
- Removed the unused `profile` parameter from `buildExecutiveSummary(...)` and its call site.
- Removed unused Simulator Hero imports, derived values, and dead confirmation JSX local.
- Removed unused Aletheia helper/constant dead code.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run lint` — passed with zero warnings.
- `npx tsc --noEmit` — passed.
- `npm run test` — 50 files passed, 367 tests passed.

Residual notes:

- `npm run build` was not run locally because this feature only removes lint warnings and dead code; CI build will still run on PR.
- No schema migration or type regeneration was needed.

## 2026-06-30 — end-to-end-flow-integrity

Status: done.

Implemented:

- Replaced stale `/dashboard/comparator` navigation with `/dashboard/simulator`.
- Added OCR handoff metadata so existing OCR jobs carry `ocrJobId` into simulator state.
- Added `resolveOcrHandoffContextAction(...)` to validate OCR job ownership server-side.
- Preserved original OCR job agent/franchise ownership when simulator proposals are persisted.
- Passed `source_ocr_job_id` into encrypted client resolution so admin conversions do not create clients under the wrong owner/franchise.
- Shared accepted-proposal side effects with public proposal acceptance via `finalizeAcceptedProposalSideEffects(...)`.
- Updated focused proposal and public acceptance tests.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run test -- src/services/crm/__tests__/proposals.test.ts` — 1 file passed, 2 tests passed.
- `npm run test -- src/app/actions/__tests__/publicProposal.test.ts` — 1 file passed, 7 tests passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run test` — 50 files passed, 367 tests passed.
- `npm run test:coverage` — 50 files passed, 367 tests passed; coverage thresholds passed.
- `npm run build` — passed.

Residual notes:

- No schema migration or Supabase type regeneration was needed.

## 2026-06-30 — sdd-status-aware-validator

Status: done.

Implemented:

- Made `sdd/scripts/validate-sdd.mjs` require spec artifacts according to feature lifecycle status.
- Preserved required root file checks, valid status checks, and the single `in_progress` feature invariant.
- Added focused Node tests for the status matrix and active-feature invariant.

Verification:

- `node --test sdd/scripts/validate-sdd.test.mjs` — passed, 5 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run lint` — passed with zero warnings.
- `npx tsc --noEmit` — passed.

Residual notes:

- No product behavior, schema migration, or Supabase type regeneration was needed.

## 2026-06-30 — production-flow-audit

Status: done.

Implemented:

- Added SDD requirements, design, and tasks for production role-flow auditing.
- Hardened commercial E2E smoke checks with route-specific assertions for dashboard, clients, invoices, proposals, simulator, wallet, settings, tariffs, and admin-access denial.
- Hardened admin E2E smoke checks with route-specific assertions for dashboard, leads, drive, reporting, agents, academy, RGPD, audit, business metrics, and unauthenticated admin redirect.
- Made admin setup validate protected `/admin` access even when login first lands on `/dashboard`.
- Confirmed invalid public proposal tokens do not expose accept/sign/contract actions.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run lint` — passed with zero warnings.
- `npx tsc --noEmit` — passed.
- Production smoke on `https://zinergia-app.vercel.app`: `npx playwright test e2e/admin.spec.ts --project=chromium-admin --reporter=list` — 13 passed.
- Production smoke on `https://zinergia-app.vercel.app`: `npx playwright test e2e/dashboard.spec.ts e2e/proposal-public.spec.ts --project=chromium --reporter=list` — 12 passed, 3 skipped.

Residual notes:

- Public proposal valid-token acceptance remains skipped because `E2E_PROPOSAL_TOKEN` is not configured; no real proposal was accepted or mutated in production.
- The custom domain `https://www.zinergia.es` returned HTTP 200 but did not expose the app login form during this smoke run, so production flow verification used the Vercel app URL.
- No schema migration or Supabase type regeneration was needed.

## 2026-06-30 — public-proposal-e2e-fixture-flow

Status: done.

Implemented:

- Added a guarded staging seed script for deterministic public proposal fixtures.
- Added `test:e2e:seed-public-proposal` to create/refresh fixture rows and optionally write token variables to `.env.staging.local`.
- Split E2E token intent into `E2E_PUBLIC_PROPOSAL_TOKEN` for read/signature-step smoke and `E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN` for future destructive acceptance tests.
- Updated public proposal, simulator, and accessibility tests to prefer the new read-only token while accepting `E2E_PROPOSAL_TOKEN` as a temporary fallback.
- Documented staging seed, token roles, and production smoke boundaries in `e2e/README.md`.

Verification:

- Staging fixture seed: `E2E_ALLOW_STAGING_SEED=1 npm run test:e2e:seed-public-proposal -- --write-env` — passed.
- `npm run test:e2e -- e2e/proposal-public.spec.ts --project=chromium --reporter=list` — 6 passed.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run lint` — passed with zero warnings.
- `npx tsc --noEmit` — passed after removing stale generated `.next/` output.

Residual notes:

- Staging was behind the local migration baseline; `db push` is blocked by old remote migration history. The missing public proposal columns/policies and `proposals.notes` were reconciled directly in staging using existing repo migration intent so the E2E fixture can run. Production schema was not changed.
- Playwright's local dev server printed `ECONNRESET` while shutting down after the passing public proposal run; the test result itself was green.

## 2026-06-30 — acceptance-side-effects-idempotency

Status: done.

Implemented:

- Audited authenticated proposal acceptance side effects after reviewing the OCR -> proposal -> firma -> comision chain.
- Found and fixed duplicate accepted follow-up task creation: `updateProposalStatusAction(..., 'accepted')` now lets `finalizeAcceptedProposalSideEffects` own accepted tasks/contracts/commissions.
- Added a focused regression test proving authenticated acceptance creates the documentation task only once.
- Kept public acceptance behavior unchanged; it still uses the shared finalizer after atomic signature acceptance.

Verification:

- `npm run test -- src/app/actions/__tests__/proposals.test.ts` — initially failed with 2 task inserts, then passed after the fix.
- `npm run test -- src/app/actions/__tests__/publicProposal.test.ts src/app/actions/__tests__/proposals.test.ts` — passed, 8 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npm run lint` — passed with zero warnings.
- `npx tsc --noEmit` — passed.
- `npm run test` — passed, 51 files and 368 tests.
- `npm run build` — passed.

Residual notes:

- No schema migration or Supabase type regeneration was needed.
- Full mutating public proposal E2E remains a separate staging-only follow-up because it intentionally accepts a fixture and mutates staging data.

## 2026-06-30 — mutating-public-proposal-e2e

Status: done.

Implemented:

- Added a guarded staging-only Playwright spec for full public proposal acceptance with real signature interaction.
- Added `test:e2e:public-mutating` with `--no-deps` so the public unauthenticated flow does not depend on admin/agent login setup.
- Made the public proposal fixture seed reset proposal side effects in `network_commissions`, `tasks`, and `contracts`.
- Hardened public acceptance context loading by fetching the agent profile separately instead of relying on a fragile PostgREST embedded relationship.
- Fixed commission creation to resolve the franchise commission recipient as a `profiles.id` while preserving operational `franchises.id` on proposals/tasks/contracts.
- Added staging reconciliation SQL scripts for existing local migrations that staging was missing while remote migration history blocks `db push`.

Verification:

- `node --check scripts/ensure-e2e-public-proposal.mjs` — passed.
- `npm run test -- src/app/actions/__tests__/publicProposal.test.ts` — passed, 7 tests.
- `npm run test -- src/app/actions/__tests__/proposals.test.ts src/app/actions/__tests__/publicProposal.test.ts` — passed, 8 tests.
- `npx tsc --noEmit` — passed.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `E2E_ALLOW_STAGING_SEED=1 npm run test:e2e:seed-public-proposal` — passed.
- `E2E_RUN_MUTATING_PUBLIC_PROPOSAL=1 npm run test:e2e:public-mutating` — passed, 1 test.
- `npm run lint` — passed with zero warnings.
- `npm run test` — passed, 51 files and 368 tests.
- `npm run build` — passed.

Residual notes:

- Staging still has historical migration drift; the reconciliation scripts are staging-only operational scripts, not new product schema migrations.
- The focused Playwright run still prints the known Next/Node `DEP0190` webServer warning after success.

## 2026-07-01 — staging-migration-history-reconciliation

Status: done.

Implemented:

- Created the SDD spec for staging migration history reconciliation.
- Captured the local migration source of truth and documented the known remote-only migration versions from the previous staging `db push` failure.
- Verified production/linked history remained read-only; no production mutation was attempted.
- Documented the safe staging repair procedure with `migration list`, `db push --dry-run`, `migration repair --status reverted`, and post-repair verification.
- Reconciled staging history by reverting remote-only missing-source migration versions.
- Applied pending local migrations to staging and resolved stale staging-only view/policy conflicts.
- Relinked the repo back to production after staging verification.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx supabase migration list --linked` against staging — local and remote aligned through `20260630131500`.
- `npx supabase db push --dry-run --linked` against staging — `Remote database is up to date.`

Residual notes:

- A database password was pasted in chat during the operator flow; rotate it if it is still active.
- The local repo is linked back to production (`gmjgkzaxmkaggsyczwcm`), so future staging work should explicitly relink staging first.

## 2026-07-01 — public-acceptance-switch-trigger-fix

Status: done.

Implemented:

- Investigated the failing staging mutating public proposal E2E after migration reconciliation.
- Found the root cause: `public.auto_log_switch_event()` referenced `NEW.closed_company`, but the trigger runs on `public.proposals` and that column exists on `ocr_jobs`, not `proposals`.
- Added `20260630230425_fix_auto_switch_event_marketer.sql` to derive `new_marketer` from `offer_snapshot` with a safe fallback.
- Applied the migration to staging and relinked the repo back to production.

Verification:

- `npx supabase db push --dry-run --linked` against staging — listed only `20260630230425_fix_auto_switch_event_marketer.sql` before applying.
- `npx supabase db push --linked` against staging — applied the migration.
- `npx supabase db push --dry-run --linked` against staging — `Remote database is up to date.`
- `E2E_ALLOW_STAGING_SEED=1 npm run test:e2e:seed-public-proposal -- --write-env` — passed.
- `E2E_RUN_MUTATING_PUBLIC_PROPOSAL=1 npm run test:e2e:public-mutating` — passed, 1 test.

Residual notes:

- The local repo was relinked to production (`gmjgkzaxmkaggsyczwcm`) after staging verification.
- The known Playwright webServer `DEP0190` warning still appears after successful E2E runs.
