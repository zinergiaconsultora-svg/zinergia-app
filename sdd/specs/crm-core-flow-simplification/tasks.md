# CRM Core Flow Simplification Tasks

Status: approved on 2026-07-30. Slice 4 is in progress; T15 completed and the T16 technical workflow plus admin configuration surface are verified in staging. Approved business percentages and five partner assignments remain pending.

## Delivery Rules

- Implement in the listed order.
- Keep existing production routes working until their replacement is verified.
- Use a versioned migration for every schema, RLS, function, trigger, view, index or constraint change.
- Apply every migration to staging and verify it before production.
- Regenerate `src/types/database.types.ts` after remote schema verification.
- Use server authorization before writes and RLS as defense in depth.
- Do not guess ambiguous legacy client, CUPS, supply-point or owner relationships.
- Complete the exit gate for one delivery slice before starting the next.

## Slice 1: Opportunity Foundation

- [x] T1. Capture the implementation baseline and compatibility map.
  - Inventory current schemas, status values, write paths and route dependencies for clients, supply points, OCR jobs, proposals, activation, contracts, tasks, commissions and fiscal invoices.
  - Record existing uniqueness, RLS and public proposal constraints that must remain compatible.
  - Add a focused rollout checklist with baseline row counts and reversible verification queries.
  - Do not modify production data.
  - Traceability: `REQ-002`, `REQ-006`, `REQ-014`, `REQ-016`, `INV-009`, `INV-010`.
  - Verification: documented table/write-path map reviewed against generated database types and migrations.

- [x] T2. Add failing domain tests for the opportunity state machine.
  - Define canonical opportunity types, stages, allowed transitions and next-action rules.
  - Cover won/lost terminal behavior, audited reopening, stage age and overdue grouping.
  - Cover renewal as a new opportunity instead of reopening a won opportunity.
  - Cover role restrictions for activation, reassignment and economic transitions.
  - Traceability: `REQ-003` to `REQ-010`, `REQ-017` to `REQ-020`, `INV-003`, `INV-005`, `INV-013`, `INV-014`.
  - Verification: focused tests fail for the intended missing implementation.

- [x] T3. Create the additive opportunity foundation migration.
  - Create `public.opportunities`.
  - Create append-only `public.opportunity_stage_history`.
  - Add nullable `opportunity_id` relationships to OCR jobs, proposals, activation, contracts, commissions and tasks.
  - Add required supply-point relationships and OCR confirmation fields.
  - Add explicit contract permanence state.
  - Add indexes and constraints for owner queues, stage age, due actions, proposal/contract/commission uniqueness and one renewal per source contract.
  - Add RLS policies for agent, franchise and admin scopes.
  - Add comments and least-privilege grants.
  - Traceability: `REQ-002`, `REQ-006`, `REQ-008`, `REQ-009`, `REQ-014`, `REQ-017` to `REQ-020`, `INV-006` to `INV-011`, `INV-015`.
  - Verification: local lint/dry-run, staging apply, schema queries, RLS checks and remote type generation.

- [x] T4. Implement safe legacy backfill and reconciliation reporting.
  - Create a timestamped, idempotent backfill script with target environment, operator procedure, verification and rollback notes.
  - Build opportunities only for deterministic client, supply-point, proposal and contract groupings.
  - Use protected hashes/server logic for CUPS identity; never decrypt PII in SQL.
  - Produce ambiguous-row counts and safe identifiers for admin reconciliation.
  - Verify repeated execution does not duplicate opportunities or history.
  - Traceability: `REQ-002`, `REQ-011`, `REQ-016`, `REQ-019`, `INV-001`, `INV-002`, `INV-009`, `INV-015`.
  - Verification: staging before/after counts, duplicate checks and sampled relationship checks.

- [x] T5. Implement opportunity domain types and authorized transition service.
  - Add CRM domain types independent from raw database rows.
  - Implement conditional/locked stage transitions with append-only history.
  - Calculate one explicit next action and due date.
  - Enforce owner, client and supply-point consistency.
  - Replace direct stage writes at touched call sites.
  - Traceability: `REQ-017`, `REQ-018`, `REQ-019`, `INV-002`, `INV-003`, `INV-011`, `INV-013`.
  - Verification: T2 tests pass; concurrency/idempotency tests cover repeated transitions.

### Slice 1 Exit Gate

- Opportunity schema and RLS verified in staging.
- Backfill report contains no unexplained duplication or PII.
- Existing public proposal and production smoke tests remain green.
- No existing route requires the new UI to continue operating.

## Slice 2: Daily Work Experience

- [x] T6. Create the canonical opportunity work-queue read model.
  - Create `public.crm_work_queue` with `security_invoker = true`.
  - Expose only fields required for stage, owner, urgency and next action.
  - Implement `src/lib/crm/workQueue.ts` with role-safe filters.
  - Group work as `Vencido`, `Hoy`, `Proximos` and `Sin fecha`.
  - Traceability: `REQ-001`, `REQ-014`, `REQ-018`, `INV-003`, `INV-009`.
  - Verification: database/RLS tests plus server query tests for agent, franchise and admin.

- [x] T7. Connect invoice upload and OCR confirmation to opportunities.
  - Make `Nueva factura` a first-class entry action.
  - Resolve or create client and supply point by protected identity.
  - Reuse only a compatible open opportunity; otherwise create a new one.
  - Link OCR job and preserve the accountable owner.
  - Advance from invoice received to data review and proposal preparation through the state service.
  - Surface OCR retry/manual review without raw integration errors.
  - Traceability: `REQ-001` to `REQ-004`, `REQ-019`, `INV-001`, `INV-002`, `INV-009`.
  - Verification: integration tests for duplicate CUPS, multiple invoices, OCR failure and owner preservation.

- [x] T8. Implement the simplified role-aware application shell.
  - Commercial navigation: `Trabajo`, `Clientes`, `Comisiones`, `Ajustes`.
  - Admin navigation: `Operaciones`, `Clientes`, `Comisiones`, `Facturacion`, `Equipo`, `Administracion`.
  - Add persistent `Nueva factura`.
  - Keep secondary routes reachable during rollout without primary prominence.
  - Remove gradients, glass navigation and gamification from the touched shell.
  - Traceability: `REQ-001`, `REQ-015`, `INV-012`.
  - Verification: role navigation tests, keyboard/accessibility checks and mobile layout screenshots.

- [x] T9. Build the desktop/mobile work queue.
  - Implement desktop guided split view and mobile action-first list.
  - Show three compact operational summaries only.
  - Provide stage, owner, type, stage-age and urgency filters.
  - Keep a stable one-action row layout and visible empty/error states.
  - Make the optional table/pipeline view secondary.
  - Traceability: `REQ-001`, `REQ-014`, `REQ-018`, success criteria for daily work.
  - Verification: component tests, desktop/mobile Playwright screenshots and no-overlap checks.

### Slice 2 Exit Gate

- A commercial can start an invoice in one action and find it immediately in `Trabajo`.
- Agent/franchise/admin queue boundaries pass RLS and UI tests.
- Existing simulator capabilities remain available.

## Slice 3: Opportunity Workspace and Integrity

- [x] T10. Build the focused opportunity workspace.
  - Add summary, documents, proposals, activation/contract, economy and activity sections.
  - Show one primary action based on canonical next action.
  - Keep lose, reopen, reassign and correction actions exceptional and reasoned.
  - Link back to the long-lived client and selected supply point.
  - Traceability: `REQ-003` to `REQ-008`, `REQ-010`, `REQ-011`, `REQ-017`, `REQ-018`.
  - Verification: component/integration tests for stage-specific actions and multi-supply clients.

- [x] T11. Simplify the client portfolio and client record.
  - Replace feature-dashboard composition with a compact professional portfolio.
  - Show open opportunities, active supplies, owner, contract/permanence and next action.
  - Show current and historical opportunities without mixing their documents or economics.
  - Keep advanced import/filter features secondary.
  - Traceability: `REQ-011`, `REQ-014`, `REQ-019`, `INV-014`, `INV-015`.
  - Verification: multi-CUPS and successive-opportunity tests.

- [x] T12. Make proposal send and public acceptance opportunity-aware.
  - Link sent proposals to one opportunity and advance it through authorized transitions.
  - Preserve existing public-token, rate-limit and signature validation.
  - Make repeated/racing acceptance stable and idempotent.
  - Preserve the proposal owner for all downstream records.
  - Traceability: `REQ-005`, `REQ-006`, `REQ-014`, `REQ-017`, `INV-004`, `INV-006`, `INV-009`.
  - Verification: focused public acceptance security tests plus concurrent duplicate acceptance tests.

- [x] T13. Add acceptance integrity detection and safe retry.
  - Create `proposal_acceptance_integrity` as a `security_invoker = true` view.
  - Detect accepted opportunities missing activation, pending contract or commission.
  - Add protected idempotent retry for missing effects only.
  - Surface safe non-PII reconciliation items to admin.
  - Keep notifications best effort and separate from durable state.
  - Traceability: `REQ-006`, `REQ-016`, `INV-004`, `INV-006`, `INV-009`.
  - Verification: induced partial-failure tests and successful repeated reconciliation.

- [x] T14. Move activation and contract writes behind authorized server workflows.
  - Replace touched browser-side contract mutations.
  - Keep activation confirmation admin-only.
  - Require marketer, tariff, start date, supply point and explicit permanence state.
  - Mark opportunity won and client active only after confirmed activation.
  - Append activity/stage audit entries.
  - Traceability: `REQ-007`, `REQ-008`, `REQ-014`, `REQ-017`, `INV-005`, `INV-011`, `INV-013`.
  - Verification: authorization, transition and contract-integrity tests.

### Slice 3 Exit Gate

- Upload through activation can be completed from the simplified flow.
- Public acceptance security coverage remains green.
- Accepted records cannot remain silently incomplete.
- Direct contract write paths touched by the flow are removed.

## Slice 4: Renewal and Economic Lifecycle

- [x] T15. Implement idempotent renewal opportunities.
  - Use the canonical 60-day threshold on every surface.
  - Create one renewal opportunity per expiring source contract.
  - Preserve the completed original opportunity.
  - Route unknown/absent permanence to a data-quality queue.
  - Audit creation, reassignment, dismissal and completion.
  - Traceability: `REQ-008`, `REQ-009`, `REQ-018`, `REQ-019`, `INV-008`, `INV-014`.
  - Verification: boundary, timezone, duplicate-cron and multi-contract tests.

- [ ] T16. Normalize the commission lifecycle.
  - Map accepted proposal to `Pendiente`.
  - Move to `Elegible` only after activation.
  - Keep admin validation explicit.
  - Support `Facturada`, `Pagada` and full/partial audited `Revertida` through append-only events.
  - Snapshot the Zinergia allocation: marketer gross, commercial net, franchise royalty and central remainder.
  - Add admin-controlled, versioned `partner_direct` and `franchise_network` plans independent from authentication roles.
  - Assign the five current partners through business data, never hardcoded identities; direct-partner plans allocate a higher share to the partner and zero to franchise.
  - Make franchise-network commercial, franchise and central percentages explicit, with a lower commercial and higher Zinergia share than the direct-partner plan.
  - Preserve historical approved calculations while making the balanced allocation explicit for new operations.
  - Add versioned marketer/product decommission policies and freeze the applicable version at acceptance.
  - Ingest early-switch, non-consolidation, non-payment, irregular-sale and supplier-correction events as reviewable adjustments.
  - Never infer a decommission from permanence alone or equate it to a customer penalty.
  - Link opportunity, proposal, client, supply point, contract, owner, franchise, supplier statement and fiscal line.
  - Add protected transition/reversal workflows, immutable ledger, RLS and safe reconciliation queues.
  - Backfill only deterministic historical states; route contradictory `approved`, `cleared`, `paid`, `invoiced` and rejected rows to admin review.
  - Traceability: `REQ-006`, `REQ-012`, `REQ-020` to `REQ-022`, `INV-006`, `INV-007`, `INV-015` to `INV-021`.
  - Verification: direct-partner/franchise allocation matrix, self-assignment denial, transition/reversal matrix, policy-boundary tests, partial/full decomission, paid-debt offset, concurrency, RLS and existing calculation regression tests.
  - Current evidence: the technical ledger and protected workflows are verified in staging. A first-entry admin form atomically creates both versioned channel models and assigns up to five existing direct-partner profiles. A second atomic form versions marketer/product decomission policies with complete, non-overlapping and non-increasing bands. T16 remains business-pending until approved percentages, policies and real assignments are saved.

- [ ] T17. Simplify commission and fiscal-invoicing screens.
  - Remove wallet/gamification terminology from the primary workflow.
  - Show the six commission states, net amounts and traceable source operation.
  - Give commercial users one surface for pending, available to invoice, invoiced, paid and adjustments.
  - Show decomission cause, active days, frozen policy, original amount, reversed amount, evidence and dispute state.
  - Give admin three focused queues: validate commissions, prepare settlements and resolve adjustments/reconciliation.
  - Generate fiscal invoice drafts only from validated commissions.
  - Prevent duplicate inclusion and synchronize issue/cancel/pay transitions.
  - Correct issuer/recipient direction and implement explicit self-billing agreement/acceptance only when configured.
  - Generate linked rectifying documents for already invoiced decomissions.
  - Label customer energy bills, marketer statements and collaborator fiscal invoices separately.
  - Traceability: `REQ-012`, `REQ-013`, `REQ-015`, `REQ-020` to `REQ-022`, `INV-007`, `INV-012`, `INV-016` to `INV-020`.
  - Verification: integration tests for draft, self-billing acceptance, issue, cancel, pay, full/partial reversal and rectifying document.
  - Current evidence: the commercial workspace is implemented at `/dashboard/commissions`. It replaces the primary wallet route, groups the six canonical states, shows commercial original/reversed/net amounts, source proposal, marketer/product, reconciliation blockers and decomission evidence/dispute detail. `/dashboard/wallet` is now an HTTP compatibility redirect, notifications use the canonical route, pure mapping tests pass and authenticated desktop/mobile checks report no overflow, browser errors or WCAG A/AA violations. `/admin/commissions` opens with three focused operational queues for validation, settlement readiness and adjustment/reconciliation resolution; validation and resolution call only protected lifecycle RPCs with an explicit reason. The fiscal implementation is now authored locally: one transaction creates normalized validated-only lines, reserves each commission once, calculates IVA on the full base and subtracts retention, uses the commercial as issuer and Zinergia as recipient, synchronizes draft cancellation/issue/payment, requires prior and per-document self-billing acceptance, and queues linked negative rectifying invoices for confirmed post-invoice decomissions. Browser-side multi-write invoice generation and direct fiscal-profile writes were removed. The simple fiscal UI includes commercial readiness, draft selection, role/state-safe actions, central-entity setup and self-billing agreements. T17 remains open until the migration, structural verifier, rollback transaction verifier, regenerated remote types and authenticated desktop/mobile E2E pass in staging.

### Slice 4 Exit Gate

- An expiring contract creates one actionable renewal opportunity.
- Every commission is traceable from opportunity to payment.
- No commission can be billed twice.
- Every decomission is traceable to a frozen policy, source evidence, original allocation and rectifying settlement when applicable.

## Slice 5: Security, Verification and Consolidation

- [ ] T18. Complete cross-domain authorization, privacy and audit coverage.
  - Test agent, franchise, admin and public boundaries across every new relation and view.
  - Verify all mutating actions authorize before writes.
  - Verify no CUPS, DNI, signatures or tokens appear in logs, errors, history or reconciliation metadata.
  - Run Supabase security/performance advisor checks and document justified residual findings.
  - Traceability: `REQ-014`, `REQ-016`, `REQ-017`, `INV-009`, `INV-011`.
  - Verification: focused RLS/integration/security suites.

- [ ] T19. Run end-to-end professional-flow verification.
  - Commercial: upload -> OCR fixture -> review -> compare -> send.
  - Public: accept once; duplicate acceptance remains stable.
  - Admin: activation -> active contract -> eligible commission.
  - Renewal: expiring contract -> new renewal opportunity.
  - Economic: validate -> fiscal invoice -> paid.
  - Verify desktop split view, mobile task flow, loading, empty and error states.
  - Traceability: all success criteria.
  - Verification: Playwright on staging with configured credentials and captured evidence.

- [ ] T20. Promote safely and consolidate obsolete paths.
  - Run `node sdd/scripts/validate-sdd.mjs`.
  - Run `npx tsc --noEmit`.
  - Run `npm run lint`.
  - Run `npm run test`.
  - Run `npm run build`.
  - Dry-run/apply/verify migrations in staging, then repeat against production.
  - Regenerate database types from the verified production schema.
  - Remove obsolete primary-navigation entries and duplicate write paths only after E2E succeeds.
  - Record rollback point, deployment evidence, residual risks and SDD completion history.
  - Traceability: all requirements and invariants.

## Required Approval

Approving these tasks authorizes implementation in the listed slices. It does not authorize skipping staging, RLS verification, quality gates or production confirmation.

## Slice 1 Progress

- T1 completed with `implementation-baseline.md`; no remote data was queried or changed.
- T2 completed with the pure opportunity state model and 15 focused behavior tests.
- T3 migration is authored and covered by five migration-contract tests.
- Staging verification found Supabase default `service_role` privileges on history; corrective migration `20260731013000_restrict_opportunity_service_privileges.sql` revokes them explicitly.
- T3 was held open until staging preflight, PostgreSQL apply, schema verification and remote type generation succeeded.
- The executable read-only preflight is `supabase/scripts/verify_crm_opportunity_preflight.sql`; it must return zero rows.
- The post-migration verification is `supabase/scripts/verify_crm_opportunity_foundation.sql`; it must also return zero rows.
- Backfill ambiguities are exposed by `supabase/scripts/report_crm_opportunity_backfill_ambiguities.sql` using proposal UUID and safe reason only.
- Local verification passed on 2026-07-30:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run test`: 62 files, 416 tests
  - `npm run build`
  - `node sdd/scripts/validate-sdd.mjs`
- `npx supabase db lint --local` could not connect because Docker Desktop was not running. This is not recorded as a SQL pass or failure; staging validation remains mandatory.
- T3 staging completed on 2026-07-31:
  - Preflight returned zero blockers.
  - Foundation and privilege-hardening migrations applied successfully.
  - Post-migration verification returned zero blockers after explicit default-privilege correction.
  - `db push --dry-run --linked` reports staging up to date.
  - `src/types/database.types.ts` regenerated from staging and TypeScript passes.
- T4 staging completed on 2026-07-31:
  - Aggregate report found one accepted proposal with no supply point and no deterministic candidates.
  - Backfill executed twice with zero inserts/updates, proving idempotent no-op behavior for the current staging data.
  - PII-safe reconciliation reports proposal UUID `091bd4a0-9271-4ea1-9955-149a72286bbb` as `missing_supply_point`.
- T5 staging completed on 2026-07-31:
  - Atomic transition RPC applied and verified with row locking, transition validation, role restrictions, consistency checks and append-only history.
  - Transactional staging verification created one synthetic opportunity and two history events, then rolled the fixture back.
  - Generated database types include the transition RPC and TypeScript validation passes.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (63 files, 427 tests), `npm run build`, `node sdd/scripts/validate-sdd.mjs` and `git diff --check`.
  - Staging commercial smoke passed 16 tests; `/dashboard/simulator` required one retry because its first development compilation took 35.3 seconds, then loaded in 1.9 seconds.
  - Staging admin smoke passed all 13 tests, including agent/admin access boundaries.
  - Authenticated production smoke was not claimed because the configured credentials target staging.

### Slice 1 Exit Result

- Opportunity schema, RLS, least-privilege grants and transition service are verified in staging.
- Backfill and reconciliation output contains safe identifiers only and creates no ambiguous records.
- Existing routes remain operational without the new UI.
- The public proposal security behavior remains covered by the passing local suite; production promotion remains outside this slice.

## Slice 2 Progress

- T6 completed and verified in staging on 2026-07-31:
  - Migration `20260731021246_crm_work_queue.sql` creates a read-only `security_invoker` and `security_barrier` view for open opportunities.
  - The view exposes only operational identifiers, safe display labels, stage age, owner, next action and urgency; it excludes plaintext identity, contact, token, signature and economic fields.
  - Authenticated and service roles have `SELECT` only; `anon` and `PUBLIC` have no access.
  - Transactional RLS verification proved agent-own, franchise-portfolio and admin-global visibility with synthetic non-PII fixtures followed by `ROLLBACK`.
  - Structural verification returned zero rows and the staging migration dry-run reports up to date.
  - Generated database types include `crm_work_queue`.
  - `src/lib/crm/workQueue.ts` provides the stable domain contract, validation, role-safe owner scope and ordered `Vencido`, `Hoy`, `Próximos`, `Sin fecha` groups.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (65 files, 435 tests), `npm run build`, `node sdd/scripts/validate-sdd.mjs` and `git diff --check`.
- T7 completed and verified in staging on 2026-07-31:
  - Migration `20260731103431_crm_ocr_opportunity_workflow.sql` adds service-only atomic reconciliation and confirmation RPCs.
  - OCR reconciliation receives only application-protected CUPS/DNI values, serializes matching by CUPS hash, preserves the existing client owner and reuses only the compatible open switch opportunity.
  - Completed asynchronous callbacks and synchronous OCR responses now link the OCR job to its client, supply point and canonical opportunity; incomplete identities are routed to a safe manual-review state.
  - OCR confirmation now authorizes before service-role work, persists reviewed data atomically and advances `data_review` to `proposal_preparation` before updating sanitized training memory.
  - The simulator waits for durable server confirmation before presenting success.
  - Transactional staging verification covered duplicate jobs, repeated CUPS, owner preservation, failed OCR rejection, confirmation and idempotent retry, then rolled all fixtures back.
  - Effective privilege checks proved both RPCs unavailable to `anon` and `authenticated` and executable by `service_role` only.
  - Staging types were regenerated and `db push --dry-run --linked` reports up to date.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (67 files, 445 tests) and `npm run build`.
- T8 completed and browser-verified on 2026-07-31:
  - `src/lib/navigation/appNavigation.ts` is the single role-aware source for primary and secondary navigation.
  - Commercial primary navigation is limited to `Trabajo`, `Clientes`, `Comisiones` and `Ajustes`; franchise network tools remain available under `Más`.
  - Admin primary navigation uses the approved six operational categories: `Operaciones`, `Clientes`, `Comisiones`, `Facturación`, `Equipo` and `Administración`.
  - Both dashboard and admin now share one quiet, non-glass application header, with role resolved on the server instead of a client-side permission lookup.
  - `Nueva factura` remains visible in the fixed header on desktop, tablet and mobile.
  - Secondary and legacy routes remain reachable through `Más`; mobile includes admin categories that do not fit in the four-tab bar.
  - Real-browser checks passed for agent and admin at 1440x900 and 390x844 with no horizontal overflow or shell-element overlap.
  - Axe checks scoped to desktop header and mobile navigation returned zero violations for agent and admin.
  - Navigation contract and component tests cover role categories, active routes, persistent invoice entry and secondary-route reachability.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (69 files, 452 tests) and `npm run build`.
- T9 completed and verified in staging on 2026-07-31:
  - `/dashboard` is now the single `Trabajo` surface for agents and franchises; the separate chart-heavy commercial and franchise dashboards are no longer primary entry points.
  - Every open opportunity is deduplicated by `opportunity_id`, then ordered deterministically by urgency, due date, stage age and identifier.
  - The default view contains only three operational summaries: `Pendientes`, `Vencidos` and `Para hoy`.
  - Search uses the same queue and optional filters cover stage, type and responsible person without creating parallel result surfaces.
  - Desktop uses a guided list/detail composition; mobile keeps one compact row and exposes the next action directly.
  - The empty state removes useless counters/search/filters and keeps one contextual `Subir factura` action; the persistent global invoice action remains in the shell.
  - Migration `20260731111232_crm_work_queue_owner_name.sql` appends only the safe operational owner name to the RLS-aware view; it exposes no owner contact or protected client identity.
  - Structural and transactional RLS verification passed in staging, generated types include `owner_name`, and the migration dry-run reports staging up to date.
  - Component and domain tests cover duplicate suppression, urgency filtering, shared search, role-aware owner filtering and the reduced empty state.
  - Real-browser verification passed at 1440x900 and 390x844 with no horizontal overflow, page errors, console errors or Axe violations.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (70 files, 459 tests) and `npm run build`.

### Slice 2 Exit Result

- A commercial starts a new invoice from the persistent shell action and receives one canonical opportunity in `Trabajo`.
- The queue is role-scoped by RLS and adds an explicit owner filter only for portfolio managers.
- Existing simulator, proposal, invoice and advanced routes remain reachable without competing in the primary navigation.

## Slice 3 Progress

- T10 completed and verified locally on 2026-07-31:
  - `/dashboard/opportunities/[id]` is the canonical focused workspace opened from every `Trabajo` action.
  - The server read authorizes before database access and relies on session RLS; no service-role read is used.
  - Documents, proposals, contracts, commissions, tasks and immutable history are loaded by `opportunity_id`, preventing cross-linking between supply points or successive commercial cycles for one client.
  - The pure workspace model rejects client, supply-point, owner, type, stage and next-action boundary mismatches and defensively removes unrelated rows.
  - The header shows client, selected supply, opportunity type, canonical stage, stage age and responsible person with exactly one primary action.
  - Summary, documents, proposals, activation/contract, economy and activity use one continuous record instead of nested dashboards or repeated metric cards.
  - The workspace links back to the long-lived client record while keeping proposal, contract and economic records scoped to the current opportunity.
  - Administrative correction remains behind `Más acciones`; reassign, reopen and close are explicitly identified as reasoned administrative workflows rather than primary shortcuts.
  - Component and server tests cover stage-specific primary actions, authorization-first reads, opportunity-scoped collections and multi-supply boundary rejection.
  - Browser verification passed at 1440x1000 and 390x844 with one visible primary action, no horizontal overflow and zero Axe WCAG 2/2.1 A/AA violations.
  - The temporary public visual fixture generated expected unauthorized shell notification/profile POST errors only; it and its proxy exception were removed before final validation.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (72 files, 469 tests) and `npm run build` (41 pages).
- T11 completed and verified locally on 2026-07-31:
  - `/dashboard/clients` replaces the score/KPI/card/pipeline composition with one compact portfolio showing client, next action, supplies, current contract/permanence and responsible person or last contact.
  - Search filters the same portfolio surface; `Nuevo cliente` remains direct and CSV import moves to the secondary `Más` menu.
  - Admin and commercial navigation now share the canonical client portfolio; the legacy admin lead-management surface remains reachable only as an advanced secondary tool.
  - `/dashboard/clients/[id]` is now the long-lived relationship record with contact, supply points, open opportunities, contracts, commercial history, opportunity-labelled documents and relationship activity.
  - Open and historical opportunities remain separate; each document retains its own opportunity and supply-point labels instead of inheriting the latest client state.
  - `src/lib/crm/clientPortfolio.ts` rejects or drops cross-client supply/opportunity links and deterministically selects one urgent next action for the portfolio row.
  - Server reads authorize before opening a database session, use session RLS, select privacy-safe display fields and never decrypt full CUPS or DNI for the portfolio.
  - Multi-CUPS and successive-opportunity tests cover one client with two supplies, one historical win, one open renewal and one deliberately invalid cross-client supply link.
  - Browser verification passed for portfolio and relationship record at 1440x900 and 390x844 with no horizontal overflow and zero Axe WCAG 2/2.1 A/AA violations.
  - Temporary public visual fixtures produced only the expected unauthenticated shell profile/notification errors and were removed with their proxy exception before final validation.
  - No schema migration or remote database change was required.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (76 files, 478 tests) and `npm run build` (41 pages).
- T14 completed and verified in staging on 2026-07-31:
  - Migration `20260731191249_complete_crm_activation.sql` adds the service-only `complete_crm_activation` workflow and appends canonical opportunity and supply-point identifiers to the existing activation view.
  - The workflow locks proposal and opportunity rows, independently verifies the actor is admin, validates accepted/activation state and canonical ownership, and requires marketer, tariff, start date and explicit permanence state.
  - Contract upsert, proposal activation, `activation -> won`, client activation and both audit entries execute in one database transaction; a partial active state cannot be committed.
  - The admin UI keeps activation inside the existing expediente and asks for only four compact inputs; the end date appears only for known permanence and the action remains disabled until required data is complete.
  - `supabase/scripts/verify_complete_crm_activation.sql` returned `ok` in staging, proving effective privileges, view shape and current active-contract integrity; the staging migration dry-run reports up to date.
  - Database types were regenerated from staging and include `complete_crm_activation`, `opportunity_id` and `supply_point_id`.
  - Browser verification passed at 1440x1100 and 390x844 with no horizontal overflow; the conditional permanence field and disabled incomplete state were visually confirmed. The temporary unauthenticated fixture produced only its expected rejected history request and was removed.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (78 files, 494 tests) and `npm run build` (41 pages).

### Slice 3 Exit Result

- The simplified flow now reaches one atomic admin activation action from an accepted proposal.
- A won opportunity always has a canonical active contract with client, owner, supply point and permanence state.
- Acceptance integrity and public proposal security coverage remain green.
- The touched activation path no longer writes contracts or terminal CRM state directly from the browser.

## Slice 4 Progress

- T15 completed and verified in staging on 2026-07-31:
  - Migration `20260731194241_canonical_contract_renewals.sql` makes active contracts the canonical renewal source and enforces one renewal opportunity per source contract.
  - The service-only reconciliation opens renewals at 60 days and records durable, idempotent in-app reminders at 60, 30, 7 and 0 days; repeated cron runs cannot duplicate the opportunity, reminder, history or notification.
  - Contracts with unknown permanence stay out of guessed renewal dates and appear in the role-scoped `contract_renewal_data_quality` view with one direct correction action: confirm an end date or confirm no permanence.
  - The daily `detect-renewals` cron is now the sole scheduled renewal process; the former permanence endpoint delegates to it for compatibility and its duplicate Vercel schedule was removed.
  - Reconciliation preserves the won source opportunity and creates a new `renewal` opportunity owned by the contract owner. A recent confirmed invoice routes it to proposal preparation; otherwise it requests an updated invoice.
  - Structural and transactional staging verification passed, including exact 60-day eligibility, repeated reconciliation, unknown-permanence correction and rollback of synthetic fixtures. The staging migration dry-run reports up to date.
  - Generated database types include the renewal reminder table, data-quality view, reconciliation RPC and protected permanence-confirmation RPC.
  - Local gates passed: `npx tsc --noEmit`, `npm run lint`, `npm run test` (81 files, 508 tests) and `npm run build` (41 pages).
  - Browser verification passed at 1440x900 and 390x844: the correction panel has no horizontal overflow, hides the date when `Sin permanencia` is selected and produced zero console errors.
