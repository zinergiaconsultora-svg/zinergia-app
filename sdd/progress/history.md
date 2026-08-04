# SDD History

## 2026-08-03 — profile-authority-hardening Slice 0

Status: complete; feature remains in progress.

Implemented:

- Captured guarded staging catalog, grant, policy, trigger, migration, Auth-signup and aggregate data-quality evidence without querying or mutating production.
- Classified the noncanonical staging Admin tuple, broad profile privileges, enabled signup and missing authority/Auth guards as explicit later-slice blockers.
- Added 53 reviewed RED application/domain contracts for identity, authority, invitations, provisioning and protected readers.
- Added fail-closed structural, rollback-only transactional, future 50-case HTTP/PostgREST and five-window Auth/reconciler verifier contracts.

Verification:

- Staging migrations aligned through `20260802110130`; PostgreSQL `17.6`; effective access-token lifetime 3600 seconds.
- Focused T2 Vitest: 53 expected contractual failures.
- Focused T3 Vitest: 3 harness tests pass and 3 expected implementation contracts fail.
- `npx tsc --noEmit`, focused ESLint, `node --check`, `git diff --check` and `node sdd/scripts/validate-sdd.mjs` pass.
- Independent adversarial agent review returned GO for T2 and T3 after corrective rounds.

Residual notes:

- No migration or production implementation was created during Slice 0.
- Production was not queried or mutated.
- The next allowed work is T4-T5 in one unapplied additive expansion migration.

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
- Production was reconciled after PR #61 merged: remote-only missing-source history was reverted, already-materialized `20260616090000` through `20260626220000` versions were marked applied after a read-only schema check, and `20260630230425_fix_auto_switch_event_marketer.sql` was applied.
- Final production verification returned `Remote database is up to date.`
- The local repo is linked to production (`gmjgkzaxmkaggsyczwcm`), so future staging work should explicitly relink staging first.

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

- The migration was later applied to production after production migration history was reconciled; final production `db push --dry-run` returned `Remote database is up to date.`
- The local repo is linked to production (`gmjgkzaxmkaggsyczwcm`) after verification.
- The known Playwright webServer `DEP0190` warning still appears after successful E2E runs.

## 2026-07-01 — alta-reject-modal-accessibility

Status: done.

Implemented:

- Added ZIN-SDD-023 for the reject alta modal accessibility follow-up.
- Added dialog semantics to the reject modal with `role="dialog"`, `aria-modal`, and `aria-labelledby`.
- Associated the visible `Motivo` and `Nota (opcional)` labels with their select and textarea controls.
- Updated the component regression to query the modal and fields by accessible role/name.

Verification:

- `npx vitest run src/features/admin/components/__tests__/ExpedienteAlta.test.tsx` — passed, 4 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm run test` — passed, 53 files and 377 tests.
- `npm run test:coverage` — passed.
- `npm run build` — passed.

Residual notes:

- Full browser validation of the live admin modal still depends on an authenticated admin session plus an existing alta expediente; the committed regression covers the accessible names and unchanged payload behavior deterministically.

## 2026-07-01 — vercel-archive-deploy

Status: done.

Implemented:

- Investigated the failed post-merge production deploy for PR #74.
- Confirmed the failure was Vercel CLI upload limiting: `api-upload-free` over 5000 uploaded files.
- Added `--archive=tgz` to both production and preview `vercel deploy --prebuilt` commands in GitHub Actions, following Vercel CLI docs.

Verification:

- `rg -n "vercel deploy --prebuilt" .github/workflows/ci-cd.yml` — both commands include `--archive=tgz`.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- PR #75 CI passed lint/typecheck, unit coverage, security, build and Vercel preview.

Residual notes:

- The definitive production deploy verification happens on the post-merge `main` workflow because production deploy is intentionally skipped on PR branches.

## 2026-07-01 — alta-reject-modal-focus

Status: done.

Implemented:

- Added ZIN-SDD-025 for keyboard focus management in the alta rejection modal.
- Moved initial focus to the rejection reason select when the dialog opens.
- Trapped Tab and Shift+Tab navigation inside the dialog controls.
- Closed the dialog on Escape without submitting rejection data.
- Restored focus to the "Rechazar alta" opener when the dialog closes.
- Added a focused regression test for keyboard focus cycling and Escape behavior.

Verification:

- `npx vitest run src/features/admin/components/__tests__/ExpedienteAlta.test.tsx` — passed, 5 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run test` — passed, 53 files and 378 tests.
- `npm run test:coverage` — passed, thresholds met.
- `npm run build` — passed.

Residual notes:

- A first full `npm run test` attempt was run in parallel with `npm run build` and one existing test timed out; rerunning the test suite alone passed cleanly.

## 2026-07-01 — github-actions-node24-actions

Status: done.

Implemented:

- Added ZIN-SDD-026 for the GitHub Actions Node runtime warning cleanup.
- Updated all `actions/checkout@v4` references to `actions/checkout@v6`.
- Updated all `actions/setup-node@v4` references to `actions/setup-node@v6`.
- Preserved `NODE_VERSION: '20.x'` for application commands, keeping the app on the existing supported Next.js 16 runtime.
- Preserved npm caching and Vercel deploy commands, including `--archive=tgz`.

Verification:

- `rg -n "actions/(checkout|setup-node)@|NODE_VERSION|archive=tgz|vercel deploy --prebuilt" .github/workflows/ci-cd.yml` — confirmed updated action versions and preserved deploy commands.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run test` — passed, 53 files and 378 tests.
- `npm run test:coverage` — passed, thresholds met.
- `npm run build` — passed.

Residual notes:

- Documentation check: current GitHub Actions examples use newer checkout/setup-node actions, `actions/checkout` v5+ uses Node 24 internally, and `actions/setup-node` v6 preserves `node-version` plus npm cache inputs.
- Next.js 16 requires Node.js `>=20.9.0`; this iteration intentionally did not change the app command runtime from `20.x`.

## 2026-07-01 — security-scan-advisory-warning

Status: done.

Implemented:

- Added ZIN-SDD-027 for cleaning the advisory npm audit display in CI.
- Replaced the bare `npm audit --audit-level=high` advisory step with a shell block that captures the exit code.
- Preserved the full npm audit output in logs.
- Emits a GitHub Actions `::warning` annotation when audit finds high severity advisories.
- Avoids the misleading failed-step annotation while keeping Trivy, SARIF upload, and deploy behavior unchanged.

Verification:

- `rg -n "Run npm audit|npm audit --audit-level=high|::warning|trivy-action|upload-sarif|vercel deploy --prebuilt|archive=tgz" .github/workflows/ci-cd.yml` — confirmed audit, warning, Trivy, SARIF, and deploy commands remain present.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run test` — passed, 53 files and 378 tests.
- `npm run test:coverage` — passed, thresholds met.
- `npm run build` — passed.

Residual notes:

- Documentation check: GitHub Actions workflow commands support `::warning` annotations; step exit codes determine failed vs passed step display.
- PR CI is the definitive verification that the advisory warning replaces the previous failed-step annotation.

## 2026-07-01 — admin-leads-empty-guidance

Status: done.

Implemented:

- Added ZIN-SDD-028 for admin leads empty-state guidance.
- Added `buildAdminLeadsEmptyState(...)` to select queue-specific or outcome-specific operational copy.
- Updated `/admin/leads` empty state to explain whether a queue is healthy and what the admin can review next.
- Kept filters, queue buttons, bulk actions, detail drawer, and mutations unchanged.
- Added focused tests for copy selection without Supabase or browser credentials.

Verification:

- `npx vitest run src/features/admin/leads/__tests__/emptyState.test.ts` — passed, 3 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run test` — passed, 54 files and 381 tests.
- `npm run test:coverage` — passed, thresholds met.
- `npm run build` — passed.

Residual notes:

- This is a presentation-only UX improvement; no schema, Supabase, or auth behavior changed.

## 2026-07-01 — proposals-empty-guidance

Status: done.

Implemented:

- Added ZIN-SDD-029 for commercial proposals empty-state guidance.
- Added `buildProposalsEmptyState(...)` to distinguish first proposal creation, active filters, and empty status tabs.
- Updated `/dashboard/proposals` empty state to guide agents toward simulator + CRM save when no proposals exist.
- Preserved existing filter clearing, simulator navigation, view modes, bulk actions, CSV export, and proposal navigation.
- Added focused tests for the copy selection helper.

Verification:

- `npx vitest run src/app/dashboard/proposals/__tests__/emptyState.test.ts` — passed, 3 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run test` — passed, 55 files and 384 tests.
- `npm run test:coverage` — passed, thresholds met.
- `npm run build` — passed.

Residual notes:

- This is a presentation-only UX improvement; no schema, Supabase, auth, or proposal mutation behavior changed.

## 2026-07-01 — tasks-empty-guidance

Status: done.

Implemented:

- Added ZIN-SDD-030 for commercial tasks empty-state guidance.
- Added `buildTasksEmptyState(...)` to distinguish the first task state and empty status queues.
- Updated `/dashboard/tasks` empty state to guide agents toward creating the next follow-up.
- Preserved existing task loading, error retry, filters, creation modal, delete, and completion toggle behavior.
- Added focused tests for the copy selection helper.

Verification:

- `npx vitest run src/app/dashboard/tasks/__tests__/emptyState.test.ts` — passed, 3 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run test` — passed, 56 files and 387 tests.
- `npm run test:coverage` — passed, thresholds met.
- `npm run build` — passed.

Residual notes:

- This is a presentation-only UX improvement; no schema, Supabase, auth, or task mutation behavior changed.

## 2026-07-02 — invoicing-empty-guidance

Status: done.

Implemented:

- Added ZIN-SDD-031 for commercial invoicing empty-state guidance.
- Added `buildInvoicesEmptyState(...)` to distinguish first invoice creation and empty invoice status filters.
- Added `buildUninvoicedCommissionsEmptyState(...)` for the create-invoice modal when no commissions are selectable.
- Updated `/dashboard/invoicing` empty states with operational guidance.
- Preserved invoice fetching, error retry, filters, modal selection, generation, issue, cancel, and mark-paid behavior.
- Added focused tests for the copy selection helpers.

Verification:

- `npx vitest run src/app/dashboard/invoicing/__tests__/emptyState.test.ts` — passed, 3 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed with zero warnings.
- `npm run test` — passed, 57 files and 390 tests.
- `npm run test:coverage` — passed, thresholds met.
- `npm run build` — passed.

Residual notes:

- This is a presentation-only UX improvement; no schema, Supabase, auth, invoice action, or commission calculation behavior changed.

## 2026-07-02 — stale-ocr-pr-triage

Status: done.

Implemented:

- Added ZIN-SDD-032 for triaging stale OCR PRs from the pre-SDD period.
- Inspected open PRs `#1`, `#2`, `#3`, and `#4`.
- Confirmed their diffs are too large for GitHub's PR diff API and include broad stale project state, generated logs, old workflow files, root SQL scripts, and unrelated app changes.
- Decided not to merge or cherry-pick those branches blindly.
- Added ZIN-SDD-033 as a clean pending follow-up for OCR admin observability, the only clearly useful missing idea found during triage.

Verification:

- `git status --short --branch` — clean before triage branch.
- `gh pr list --state open --json number,title,headRefName,baseRefName,updatedAt,url,author` — confirmed PRs `#1` through `#4` were the only open PRs.
- `gh pr view <number> --json ...` — inspected PR metadata, body, commits, and file lists.
- `gh pr diff <number> --name-only` — failed with GitHub API `diff exceeded the maximum number of lines (20000)`, confirming the PRs are oversized.
- `rg -n "idempotent|ocr_result|broadcast|rateLimit|postOcrToN8n|extractSyncDataFromResponse|getOcrMetrics|ocr-metrics|_confidence|OCR_WEBHOOK_URL|WEBHOOK_API_KEY" src supabase e2e sdd` — checked which OCR ideas already exist in current `main`.

Residual notes:

- Closing old PRs does not delete the branches. Any remaining valuable idea must be reimplemented from current `main` under SDD, starting with ZIN-SDD-033 if prioritized.

## 2026-07-02 — ZIN-SDD-033 OCR admin observability

Status: done.

Implemented:

- Added SDD requirements, design, and tasks for OCR admin observability.
- Added `getOcrObservabilityAction()` using existing `ocr_jobs` operational columns only.
- Added `/admin/ocr` with recent OCR health, stale processing, retry pressure, Drive/comparison coverage, sanitized frequent errors, and 14-day trend.
- Added unit coverage for metric aggregation and error sanitization.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx vitest run src/app/actions/__tests__/ocrObservability.test.ts` — passed, 2 tests.
- `npx vitest run src/features/admin/leads/__tests__/LeadDetailDrawer.test.tsx` — passed after an earlier full-suite timeout.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm run test` — passed, 58 files and 392 tests.
- `npm run build` — passed.

Residual notes:

- No schema changes.
- The panel intentionally avoids selecting `extracted_data`, `file_name`, `file_path`, CUPS, DNI, customer names, or invoice contents.

## 2026-07-02 — ZIN-SDD-034 E2E staging CI dispatch

Status: done.

Implemented:

- Added SDD requirements, design, and tasks for a manual staging E2E workflow.
- Added `.github/workflows/e2e-staging.yml` using `workflow_dispatch`.
- Added explicit secret validation before starting the staging app or Playwright.
- Kept the default workflow read-safe; the mutating public proposal spec requires explicit input opt-in and a dedicated token.
- Updated `e2e/README.md` with required secrets, staging guard, and artifact behavior.

Verification:

- GitHub Actions docs checked via Context7 for `workflow_dispatch`, secrets contexts, and artifact upload patterns.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `node -e "import('yaml')..."` — parsed `.github/workflows/e2e-staging.yml` successfully.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm run test` — passed, 58 files and 392 tests.
- `npm run build` — passed.

Residual notes:

- The workflow cannot be executed until the required GitHub secrets are configured in the repository.

## 2026-07-02 — ZIN-SDD-035 Acceptance owner attribution

Status: done.

Implemented:

- Added SDD requirements, design, and tasks for authenticated acceptance ownership.
- Confirmed commissions, accepted documentation task, and contract already use the proposal owner.
- Fixed authenticated proposal acceptance so status notification and client timeline use `proposal.agent_id ?? actorId`.
- Preserved lead audit attribution to the authenticated actor.
- Added a focused unit test for an admin accepting an agent-owned proposal.

Verification:

- `npx vitest run src/app/actions/__tests__/proposals.test.ts` — failed before the fix, then passed with 3 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm run test` — passed, 58 files and 393 tests.
- `npm run build` — passed.

Residual notes:

- No schema changes.
- Public proposal acceptance was not changed.

## 2026-07-02 — ZIN-SDD-036 Simulator persistence warning

Status: done.

Implemented:

- Added SDD requirements, design, and tasks for simulator CRM persistence warnings.
- Added `persistenceWarning` state to the simulator flow.
- Kept calculated comparison results visible when CRM persistence fails.
- Added a non-blocking warning in simulator results with a static, PII-safe message.
- Added a focused isolated component test proving the warning is shown without CUPS/DNI.

Verification:

- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx vitest run src/features/simulator/components/__tests__/PersistenceWarningBanner.test.tsx` — passed, 2 tests.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm run test:coverage` — passed, 59 files and 395 tests; coverage thresholds passed.
- `npm run build` — passed.

Residual notes:

- No schema changes.
- The warning tells the user to retry saving instead of implying the proposal is safely persisted.

## 2026-07-02 — ZIN-SDD-037 Security dependency cleanup

Status: done.

Implemented:

- Added SDD requirements, design, and tasks for dependency advisory cleanup.
- Replaced vulnerable direct `xlsx` dependency with `@e965/xlsx`.
- Updated Excel import/export call sites to use the maintained compatible package.
- Applied safe patch updates for Next.js and ESLint tooling.

Verification:

- `npm audit --audit-level=high` — passed, 0 vulnerabilities.
- `npm audit` — passed, 0 vulnerabilities.
- `npm ls postcss xlsx @e965/xlsx next eslint eslint-config-next --all` — confirmed `xlsx` removed, `@e965/xlsx@0.20.3`, `next@16.2.10`, `eslint@9.39.4`, `eslint-config-next@16.2.10`, and `postcss@8.5.16` via override.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm run test:coverage` — passed, 59 files and 395 tests; coverage thresholds passed.
- `npm run build` — passed.

Residual notes:

- No schema changes.
- CI security visibility remains unchanged; this work removes the advisory instead of suppressing it.

## 2026-07-02 — ZIN-SDD-038 Renewal alert audit event

Status: done.

Implemented:

- Added SDD requirements, design, and tasks for renewal alert auditing.
- Extended the permanence reminder cron from 30 to 60 days.
- Changed the audit event written by the cron from generic `note_added` to `renewal_alert`.
- Added a migration that permits `renewal_alert` and aligns lead metrics/analytics to the 60-day window.
- Updated admin queue labels, empty states, and KPI copy to say "Renovaciones".
- Marked the implemented SPEC-renovaciones acceptance criteria as complete.

Verification:

- `npx vitest run src/app/api/cron/permanence-reminders/__tests__/route.test.ts src/app/actions/__tests__/invoices.test.ts src/features/admin/leads/__tests__/operationalQueues.test.ts` — passed, 3 files and 12 tests.
- `node sdd/scripts/validate-sdd.mjs` — passed.
- `npx tsc --noEmit` — passed.
- `npm run lint` — passed.
- `npm run test` — passed, 60 files and 396 tests.
- `npm run build` — passed.

Residual notes:

- The internal queue key remains `permanence_due` to preserve existing URLs.
- The optional email criterion remains out of scope; existing notifications and push remain unchanged.
- The Supabase migration is committed but not applied from this Codex session because `SUPABASE_ACCESS_TOKEN` is not available here.

## 2026-08-03 — ZIN-SDD-041 profile authority hardening, local expansion checkpoint

- Product owner approved Gate 1, Gate 2 and `tasks.md`; Slice 0 evidence and RED contracts are complete.
- Implemented one unapplied expansion migration with service-only authority commands, immutable audit, neutral Auth bootstrap, blocked invitation provisioning and durable PII-free rate-limit receipts.
- Added separate expansion-phase structural and rollback-only transactional verifiers plus a staging-only runner hardened against production refs, libpq overrides, missing TLS and unresolved fixture identifiers.
- Focused migration/verifier contracts, TypeScript, focused ESLint, Node syntax, SDD validation and diff checks pass; repeated adversarial reviews returned GO for the local artifacts.
- No migration was applied and neither staging nor production was mutated. T4-T6 remain open pending an explicit first-Admin staging recovery decision, one additional blocked Auth-backed fixture, real PostgreSQL execution and multi-session concurrency evidence.

## 2026-08-03 — ZIN-SDD-041 staging expansion checkpoint

- Applied `20260803150000_profile_authority_expand.sql` only through the explicit `dnzytocmtmnptndeczny` staging DB URL; the repository remained linked to production and no linked command was used.
- Canonicalized the sole legacy Admin through the reviewed one-off recovery, producing exactly one immutable `authority_changed/security_recovery` event and zero noncanonical Admins.
- Created one blocked, server-marked neutral Auth fixture, ran structural, rollback-only transactional and deterministic two-client concurrency gates, scanned every FK plus unconstrained authority/provisioning references, and then deleted the fixture from Auth and `profiles`.
- The structural gate discovered a retained historical execute ACL on `handle_new_user()` from `CREATE OR REPLACE`; additive migration `20260803170000_restrict_handle_new_user_execute.sql` revoked `service_role` while retaining only `supabase_auth_admin` trigger execution. Applied history was not rewritten.
- Regenerated `src/types/database.types.ts` from the explicit staging DB URL with stdout-only/prefix/content validation. Final staging state is two Auth users, two profiles, one canonical Admin, one recovery event, empty provisioning/rate/receipt tables and `db push --dry-run` up to date.
- Expansion migration, recovery, ACL fix and every database verifier were staging-only; production was neither queried nor changed. T4-T6 are complete and Slice 2 application convergence remains deliberately RED.

## 2026-08-03 — ZIN-SDD-041 compatible application checkpoint

- Completed T7-T13: canonical strict command boundary, fail-closed actor resolution, pending-account gate, own-profile/onboarding convergence, protected fiscal/IBAN/wallet flows, separate subordinate identity and Admin authority, and the complete role-aware invitation UI/derivation matrix.
- Added and applied `20260803180000_add_update_own_iban_rpc.sql` only to staging; the live rollback verifier passed, remote types were regenerated and staging migration history is up to date.
- Implemented T14 blocked provisioning and reconciliation, including recovery when Auth unban succeeds but its response is lost. Fifteen route/cron tests prove ordering, non-enumerable errors, unrelated-account refusal, post-commit evidence and non-PII alerts.
- Removed legacy public signup actions, disabled signup in local Supabase config and added an eight-character minimum. A live staging Auth verifier proved already-banned creation, neutral bootstrap, denied session/JWT and marker-guarded zero-reference cleanup. Read-only staging preflight still reports `disable_signup=false`; no unsafe whole-config push was attempted without a remote-config diff.
- T15's AST contract finds zero unexplained protected-profile dependencies and no remaining profile INSERT/DELETE/UPSERT. TypeScript, lint, diff check, build and 759 non-verifier tests pass, so T15 is complete. The full suite retains exactly one deliberate RED for the post-contract T17 HTTP/PostgREST adapter.
- Production was neither queried nor changed. No contract migration was created or applied.

## 2026-08-03 — ZIN-SDD-041 Slice 2 exit gate

- The operator disabled public signup in the approved `zinergia-staging` Supabase dashboard (ref `dnzytocmtmnptndeczny`); the dashboard reported a successful update.
- Guarded read-only preflight confirmed `disable_signup=true`, canonical profile quality remains clean and staging migration history remains aligned through `20260803180000`.
- The staging-only blocked-Auth verifier returned `BLOCKED_AUTH_STAGING_OK neutral=true jwt=false cleanup=true production=false`; its temporary fixture was removed after proving neutral bootstrap, no JWT and zero authority/provisioning/invitation references.
- T14 and T15 are complete. The next approved work is the reviewed, additive contract migration (T16); production remains out of scope and was not queried or changed.

## 2026-08-03 — ZIN-SDD-041 final profile contract in staging

- Applied `20260803190000_contract_profile_boundary.sql` only through the explicit staging database URL. It removes browser profile writes, grants only the directory projection, replaces the legacy profile policies with a canonical relationship helper, and makes authority context mandatory even for direct service-role updates.
- Effective structural verification found a missing authority tuple constraint and two untracked legacy policies in staging. Additive migrations `20260803191000_enforce_profile_authority_tuple.sql` and `20260803192000_remove_legacy_profile_policies.sql` corrected them; no applied history was rewritten and the tuple preflight found zero incompatible rows.
- The final read-only catalog verifier returned `ok`. A separate rollback-only transaction proved that authenticated direct own-profile updates and service-role authority updates without the trusted context both fail; no row persisted. Staging migration dry-run now reports up to date.
- TypeScript, lint, 39 focused contract tests, SDD validation, diff check and the 45-route production build pass. The generated type command could not run because the local Supabase CLI attempts to reach unavailable Docker; this contract adds no public table/RPC type shape, and T17 retains the type-generation retry plus the full real HTTP/PostgREST matrix.
- Production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 reusable HTTP staging verification

- Added `npm run test:profile-authority:http-staging`, guarded by an explicit staging opt-in. It discovers the existing synthetic fixture set by server-owned Auth metadata, resets only fixture passwords through Auth Admin, and executes the real Data API matrix without exposing credentials or creating duplicate accounts.
- The reusable command passed against staging. The former intentional HTTP RED is now a checked-in verifier contract; the full local suite passes with 119 test files and 769 tests, followed by TypeScript, lint and the 45-route production build.
- Production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 authenticated browser checkpoint

- The staging Playwright suite completed with 63 passing tests and 6 intentional skips. It exercised authenticated Admin and Agent flows on desktop and narrow mobile layouts, plus keyboard/dialog and Axe accessibility assertions.
- The skipped cases are explicitly conditional or out of this checkpoint: visual snapshot baselines, unavailable OCR behavior, public mutation and onboarding coverage. Negative-path and development-server connection messages did not make the suite fail.
- Production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 safe auth and invitation errors

- Hardened the login action, session proxy, invitation validation page and invitation modal so raw provider exceptions, invitation details and recipient context do not reach browser logs or UI messages. Server telemetry uses only stable safe codes where needed.
- Added regression tests for generic login failures and invitation-creation errors. Four focused profile-authority/auth test files pass (21 tests), followed by the complete suite (120 files/772 tests), ESLint, TypeScript, diff check and the 45-route production build.
- This closes the focused flow-level privacy finding only; the wider T18 observability/retention review remains explicitly open. Production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 final transactional staging verification

- Added a staging-only PowerShell runner that constructs the exact TLS pooler URL from the local environment, refuses any non-staging ref, validates the technical fixture topology and executes the final SQL verifier inside its unconditional rollback.
- The live run returned `STAGING_FINAL_TRANSACTIONAL_OK rollback=true production=false`. It verified denied direct writes for anon/authenticated/Admin contexts, a valid atomic/idempotent authority transition, denied semantic request-id reuse, and immutable authority-event update/delete/truncate. No data persisted.
- A distinct valid conflict-parent input prevents the verifier from confusing an intentional no-op with a request-id conflict. Focused verifier contracts and TypeScript pass. Production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 post-contract provisioning verification

- Added a staging-only, explicitly gated verifier that creates one owned blocked Auth fixture, waits for its neutral profile, and runs the full invite provisioning state machine under an unconditional database rollback.
- The live run returned `STAGING_PROVISIONING_TRANSACTIONAL_OK rollback=true cleanup=true production=false`: rate receipt/claim, preparation, blocked Auth record, authority commit and retry, completion, event evidence and invitation consumption all passed. The temporary Auth/profile fixture was deleted after a zero-reference assertion.
- The checked-in contract test, final authority verifier and TypeScript pass. Production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 staging type-generation recovery

- Docker Desktop was installed but its Linux engine was stopped. It was started locally, reached readiness, and the guarded official generator completed against the approved staging pooler.
- `src/types/database.types.ts` now reflects the live authority/provisioning tables and RPCs; staging migration dry-run reports up to date. TypeScript, focused verifier contracts and SDD validation pass.
- Production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 post-contract concurrency closure

- Added `pg` as a development-only dependency so the checked-in two-session staging verifier is reproducible. The production dependency audit is clean.
- The guarded provisioning verifier now creates one owned neutral blocked fixture, runs the two-session authority lock/idempotency verifier, runs the full rollback-only provisioning state machine, then proves zero references and deletes the fixture.
- The two-session gate passed after the final contract and both transactions rolled back. T17 is complete; production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 post-contract REST matrix

- Provisioned three synthetic, Auth-Admin-created `.invalid` fixture identities in staging only: one active Franchise and two direct Agents. Authority was assigned through the audited service-only command; the pre-existing staging Agent supplied the other-franchise case.
- The real Data API role matrix passed for Admin, Franchise, same-network Agents, other-network Agent and anon. It confirmed the intended row-scoped directory view, denial of fiscal/banking/system columns, and denial of direct profile update, insert and delete operations.
- The post-contract blocked-Auth verifier also returned `BLOCKED_AUTH_STAGING_OK neutral=true jwt=false cleanup=true production=false`.
- Production was neither queried nor changed.

## 2026-08-03 — ZIN-SDD-041 release-readiness closure

- Completed T18-T20 for staging and release preparation. Privacy-safe error surfaces, rate-limit/reconciler coverage, immutable authority-event evidence, retained workflow coverage and the documented authenticated staging E2E run remain green.
- Added the conditional `production-promotion-checklist.md`: it requires a separate product-owner approval, preflight, monitored checkpoint and role canary. Post-contract recovery is strictly a forward-fix or compatible-app kill switch; broad grants and audit guards must never be reopened.
- The local gates are clean: TypeScript, ESLint, SDD validation, diff check, production dependency audit and the isolated 45-route build. The full Vitest suite and prior authenticated staging E2E are recorded in the task evidence. Production was neither queried, deployed nor changed.

## 2026-08-03 — ZIN-SDD-041 production compatible checkpoint blocked

- Product approval was received and the production Auth settings were verified: public signup, manual linking and anonymous sign-in are disabled; email confirmation remains enabled.
- Direct database preflight found exactly the reviewed authority migrations pending. The compatible expansion, bootstrap execution correction and own-IBAN command were applied to production through the explicit TLS pooler URL: `20260803150000`, `20260803170000`, `20260803180000` and `20260803214216`.
- A production-only legacy explicit `service_role` execute grant survived `CREATE OR REPLACE` on `handle_new_user`. It was corrected by the new reviewed migration `20260803214216_revoke_legacy_handle_new_user_service_role.sql`, first proven in staging. Both staging and production now deny `service_role` and allow `supabase_auth_admin` for that bootstrap; staging remote types were regenerated.
- The isolated Vercel production deployment was rejected before aliasing because the account is Hobby and refuses the required `*/5 * * * *` reconciliation cron. No application deployment, final-contract migration, canary or domain promotion occurred. The production database remains in the intentionally compatible phase; do not apply `20260803190000`, `20260803191000` or `20260803192000` until a compatible deployment is live and healthy.

## 2026-08-02 — ZIN-SDD-040 CRM core flow simplification

Status: done.

Implemented:

- Established the canonical client, supply point and opportunity model from invoice OCR through proposal, acceptance, activation, contract and renewal.
- Added one commercial work queue driven by opportunity stage and next action, plus role-aware client and opportunity workspaces.
- Hardened proposal acceptance, activation and reconciliation as idempotent, auditable server workflows.
- Completed the commission lifecycle, immutable allocation snapshots, proportional decommission, supplier-statement foundations and fiscal invoicing lifecycle.
- Simplified commercial navigation around `Trabajo`, `Clientes`, `Comisiones`, `Ajustes` and the persistent `Nueva factura` action.

Verification:

- The closure record in `sdd/progress/current.md` documents staging, production, TypeScript, lint, unit, build, migration, RLS and authenticated desktop/mobile evidence.
- `sdd/specs/crm-core-flow-simplification/tasks.md` records T1 through T20 as complete.
- `sdd/feature_list.json` records the feature as `done`.

Residual notes:

- Legacy `tasks`, `next_actions` and `renewal_opportunities` paths still require explicit expand/contract cutovers before removal.
- SIPS authorization must enforce active consent and portfolio scope before cache or CNMC access.
- Catalog identity and eligible-first querying require a separate scale feature; accepted proposal price snapshots remain immutable.
