# Profile Authority Hardening Tasks

Feature: `ZIN-SDD-041 profile-authority-hardening`.

Status: `in_progress`; Gate 1, Gate 2 and the task plan were approved by the product owner on 2026-08-03. Slices 0-1 (T1-T6) are complete; Slice 2 is next.

## Delivery rules

- Implement in the listed order and close each slice exit gate before starting the next.
- Keep `ZIN-SDD-041` as the only active SDD feature.
- Do not edit an applied migration. Every schema, policy, grant, function, trigger, index or Auth-trigger definition change uses a new timestamped file in `supabase/migrations/`.
- Use `npx supabase ...`; apply and verify on staging before any production consideration. Regenerate `src/types/database.types.ts` with the project-safe PowerShell pipeline after each promoted schema checkpoint.
- Keep `SUPABASE_SERVICE_ROLE_KEY` confined to `src/lib/supabase/service.ts`. Every authenticated mutating server action calls `requireServerRole(...)` before its write. The public provisioning route is purpose-bound by invitation/provisioning, never by client authority input.
- Never log or persist passwords, raw rate-limit identifiers, full IBAN outside its dedicated store, invitation email, names or fiscal data in authority telemetry.
- Preserve existing valid profile rows, fiscal/economic snapshots, Drive claims and invoice numbering. Ambiguous or noncanonical legacy authority enters Admin review; it is never guessed.
- The expansion migration, compatible application and contract migration are separate release checkpoints. Do not create/apply the contract migration until the compatible application passes the pre-contract staging gate.
- Production promotion is not authorized by task-plan approval. It requires a separate explicit release decision after staging evidence.

## Slice 0: Evidence and red contracts

- [x] T1. Capture the effective staging and repository preflight.
  - Inventory every `profiles` reader/writer, Auth creation path, invitation consumer, private/public helper, policy, grant, trigger and dependent RPC/view; record the expected replacement or retained dedicated workflow.
  - Query linked staging for effective table/column grants, RLS policies, function owners/`prosecdef`/`search_path`, trigger definitions, Auth trigger presence, `service_role` execution and public wrappers. Refuse production and do not mutate data.
  - Report invalid/null roles, missing/inactive franchises, orphan `franchise_id`, self-parenting, cycles, incompatible tuples, legacy Franchise -> Franchise invitations and neutral/deactivated Auth accounts using safe identifiers only.
  - Record public Auth self-signup configuration and the current maximum JWT lifetime; do not infer remote state from migrations.
  - Traceability: `REQ-004`, `REQ-005`, `REQ-006`; `INV-001`, `INV-003`, `INV-006`.
  - Verification: reviewed preflight artifact with live catalog queries, zero PII output and an explicit resolve/review disposition for every anomaly class.

- [x] T2. Add failing application and domain contracts before implementation.
  - Cover strict self-service allowlist, target derived from session, unknown/mixed payload rejection and missing/inactive profile behavior.
  - Cover canonical authority tuples, mandatory reason, last Admin, self-change, missing/inactive franchise, invalid parent, cycles, stale `authority_version`, request-id conflict and actor manipulation.
  - Cover the complete Admin/Franchise invitation derivation matrix, masked public response, existing-account rejection and no invented HQ/franchise.
  - Cover protected readers, masked IBAN, explicit replacement and separation of Admin name from authority saves.
  - Record expected RED evidence caused by missing behavior, not harness or fixture failures.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`; `INV-001`, `INV-002`, `INV-003`, `INV-004`, `INV-005`.
  - Verification: focused test command fails only on the new contractual assertions.

- [x] T3. Add failing database, REST and Auth lifecycle verifiers.
  - Build synthetic fixtures for anon, Agent A/B in one franchise, Agent in another franchise, Franchise, Admin JWT, neutral profile, blocked provisioning user and service role.
  - Add structural checks for effective grants including column grants, RLS, RPC execute, pinned search paths, append-only event enforcement, provisioning/rate-limit protection, neutral bootstrap and final service-role authority guard.
  - Add transaction checks for atomic audit, retries, concurrency, invalid transitions, audit failure rollback and direct protected update rejection.
  - Add Data API checks for GET projection/row scope and denied direct INSERT/UPDATE/DELETE with benign, protected, mixed and unknown payloads.
  - Add Auth crash-window scenarios before/after blocked user creation, recording, authority commit, unban and response; assert no JWT while banned and convergence to one user/invitation/event or review state.
  - Traceability: `REQ-001` to `REQ-006`; `INV-001` to `INV-006`.
  - Verification: verifier harness runs safely, rolls back synthetic DB writes and records expected RED findings.

### Slice 0 exit gate

- Every current reader/writer has a named destination.
- Live staging state is known; production was not queried or mutated.
- The new tests fail for intended missing protections and establish a reproducible baseline.

## Slice 1: Additive authority and provisioning foundation

- [x] T4. Create the single additive expansion migration and its authority/audit section.
  - Create exactly one pending timestamped `profile_authority_expand` migration file. T5 completes this same unapplied file; it does not create a second expansion migration.
  - Add `profiles.authority_version bigint not null default 0` without rewriting existing authority.
  - Create `profile_authority_events` with safe authority-only before/after state, versions, unique request id, source provenance, RLS and no destructive profile foreign key.
  - Add row-level UPDATE/DELETE and statement-level TRUNCATE rejection for immutable events.
  - Add service-only `update_own_profile`, `update_team_member_name` and `change_profile_authority` commands with exact parameters, locks, canonical tuple validation, last-Admin/cycle/concurrency/idempotency protection and pinned empty search paths.
  - Install authority guard/audit triggers in explicit compatibility mode so only canonical commands audit initially while inventoried legacy writers remain temporarily observable.
  - Revoke default/public/anon/authenticated execution and grant only the minimum service-role execution.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-006`; `INV-001` to `INV-006`.
  - Verification: migration contract tests, SQL lint, structural catalog verifier and rollback-only transaction verifier.

- [x] T5. Complete the invitation/Auth provisioning section in the same pending expansion migration.
  - Continue the single unapplied expansion file created by T4; keep authority, provisioning, rate limiting and neutral bootstrap in one atomic schema checkpoint approved by the design.
  - Add validated `network_invitations.target_franchise_id` semantics for Admin-created Agent/Franchise invitations while Franchise -> Agent derives its locked active franchise.
  - Create service-only `profile_invitation_provisioning` with unique invitation/request/Auth-user ids and explicit `prepared`, `auth_created_blocked`, `authority_committed`, `completed` and `needs_reconciliation` states.
  - Create the shared peppered rate-limit store with expiry/indexes, RLS and revoked browser privileges.
  - Add service-only begin, record, finalize, complete and reconciliation primitives; finalization locks invitation/profile/creator, requires a neutral target and commits derived authority, invitation use, event and provisioning state atomically.
  - Replace `handle_new_user()` with neutral, non-overwriting `role/parent_id/franchise_id = null` bootstrap semantics and verify its effective Auth trigger binding.
  - Keep the provisioning user blocked in Auth until after `authority_committed`; database functions never receive or store a password.
  - Traceability: `REQ-002`, `REQ-003`, `REQ-004`, `REQ-006`; `INV-001`, `INV-003`, `INV-004`, `INV-006`.
  - Verification: migration contract tests plus rollback-only invitation matrix, concurrency, idempotency and neutral-bootstrap verifier.

- [x] T6. Apply and approve the expansion checkpoint on staging.
  - Apply only the single additive expansion migration to the linked staging project and record its exact version.
  - Run structural/transactional verifiers, function dependency scan, recursion checks for private RLS helpers and compatibility checks for all retained legacy writers.
  - Regenerate remote database types without risking an empty file; run focused type and migration tests.
  - Confirm public Auth self-signup can be disabled through the approved environment configuration and document the production parity check without changing production.
  - Traceability: `REQ-003`, `REQ-005`, `REQ-006`; `INV-003`, `INV-004`, `INV-006`.
  - Verification: staging expansion GO report, linked migration history matched, generated types committed with the expansion migration and no contract revocation present.
  - Staging evidence (2026-08-03): applied `20260803150000_profile_authority_expand.sql` by explicit staging DB URL; the repository link remained production and was never used. A catalog gate exposed a retained historical `service_role` execute grant on `handle_new_user()`, corrected without rewriting applied history by `20260803170000_restrict_handle_new_user_execute.sql`. Structural, rollback-only transactional and two-client concurrency gates passed. The sole legacy Admin was canonicalized with one immutable `security_recovery` event. A blocked neutral Auth fixture was created for verification, proved to have zero domain references and was deleted from Auth/profile afterward. Remote types were regenerated from the explicit staging DB URL and a final dry-run reports up to date. Public self-signup remains an environment setting to disable in T14; production was neither queried nor changed.

### Slice 1 exit gate

- Expansion is additive and compatible with the current app.
- Authority/provisioning commands are service-only and transactionally verified.
- Existing valid profiles and economic/fiscal history are unchanged.
- No broad profile grant or policy has yet been contracted.

## Slice 2: Compatible application convergence

- [x] T7. Implement strict application contracts and the canonical command boundary.
  - Add strict schemas/types for own profile, subordinate name, authority summaries/change, invitation creation/provisioning and fiscal/wallet readers; reject unknown fields and generic `profiles` payloads.
  - Centralize service-only RPC calls in named server modules and bind actor ids only from `auth.getUser()` after the required action guard.
  - Add architecture tests that reject service-key imports outside the approved module, generic profile mutators and authority RPC calls outside canonical command modules.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-004`, `REQ-006`; `INV-001`, `INV-002`, `INV-003`, `INV-006`.
  - Verification: strict schema, safe error and static architecture tests pass.

- [x] T8. Introduce trusted actor resolution and remove implicit authority repair.
  - Implement `getTrustedActorProfile()` and align `getUserRole`, `requireServerRole` and tenant loaders with canonical active Admin/Franchise/Agent tuples.
  - Remove `ensureProfile` writes, invented Agent role, HQ substitution and cached fallback authority from `services/crm/shared.ts`; reads fail closed and have no side effects.
  - Show a single pending/suspended account surface with sign-out and support contact before tenant loaders run for missing, neutral, deactivated or invalid-franchise profiles.
  - Traceability: `REQ-004`, `REQ-006`; `INV-001`, `INV-002`, `INV-003`, `INV-006`.
  - Verification: unit/integration tests for every actor state, no redirect loop and zero writes from reads/page visits.

- [x] T9. Converge own profile, onboarding and settings.
  - Implement `updateOwnProfileAction` over the exact RPC and keep `updateAgentProfileAction` only as a temporary compatible adapter.
  - Limit the personal form to `full_name`, `phone`, `bio` and `timezone`; onboarding continues with name/phone through the same command.
  - Stop mapping company name to `full_name`; company/configuration stays in `franchise_config` and fiscal settings stay dedicated.
  - Traceability: `REQ-001`, `REQ-004`, `REQ-006`; `INV-001`, `INV-002`, `INV-003`, `INV-006`.
  - Verification: action/component tests for own target, exact allowlist, legacy adapter and unchanged authority/fiscal fields.

- [x] T10. Protect fiscal, IBAN, wallet and invoicing readers/writers.
  - Add `getOwnFiscalProfileAction` and `getOwnWalletIdentityAction`; return `hasIban` and a mask, never stored full IBAN.
  - Migrate browser `profileFiscalService`, wallet, `getIbanAction`, withdrawal and invoicing readers before direct fiscal-column SELECT is removed.
  - Read full IBAN internally only after authorization; make `saveIbanAction` a compatible adapter to the dedicated IBAN workflow, and invalidate fiscal verification when required.
  - Keep Drive folder claim, fiscal verification and transactional invoice numbering isolated.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-004`, `REQ-006`; `INV-002`, `INV-003`, `INV-005`, `INV-006`.
  - Verification: mask/no-leak tests, explicit replacement behavior, own scope, withdrawal/invoice integration and unchanged historical snapshots.

- [x] T11. Separate subordinate identity from authority.
  - Implement `updateTeamMemberNameAction`; Admin may correct any valid target name and Franchise only a direct Agent with the same active franchise under a locked DB predicate.
  - Replace `updateNetworkUserAction` with name-only compatibility or remove it after callers move; profile email is read-only.
  - Remove Franchise-facing role, franchise, deactivate/reactivate, email-write and delete controls from the network editor.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-004`; `INV-001`, `INV-002`, `INV-003`, `INV-006`.
  - Verification: same/other tenant, wrong role, concurrent relationship change and immutable-email action/UI tests.

- [x] T12. Converge Admin authority management into one explicit workflow.
  - Add `getAdminProfileAuthoritySummariesAction` including `authorityVersion` and `changeProfileAuthorityAdminAction` with mandatory closed reason and stable request id.
  - Replace the combined `updateAgentAdminAction`: `Editar nombre` uses T11 and `Cambiar autoridad` uses one shared accessible confirmation showing current -> proposed tuple.
  - Convert assign/remove franchise, role change, deactivate and reactivate actions to adapters of the same command; deactivation/removal clears the full tuple and reactivation requires a complete tuple.
  - Prevent double submission and refresh only affected views; never claim partial success across identity/authority saves.
  - Traceability: `REQ-002`, `REQ-003`, `REQ-004`, `REQ-006`; `INV-001` to `INV-006`.
  - Verification: action/component tests for all transitions, reason/version/idempotency errors, focus/keyboard behavior and independent save failure.

- [x] T13. Converge invitation creation and public validation.
  - Enforce Admin -> Agent/Franchise with explicit active target franchise and Franchise -> Agent with its own locked active franchise; reject Franchise -> Franchise/Admin and invalid creators at creation and finalization.
  - Update the invitation UI to request a target franchise only from Admin; acceptance never submits role, parent or franchise.
  - Return only validity, localized role label and masked email hint from public validation; remove full email, creator id and raw authority fields.
  - Send invitation email only after durable invitation creation; delivery failure remains visible/retryable without duplicating authority state.
  - Traceability: `REQ-002`, `REQ-003`, `REQ-004`; `INV-001`, `INV-002`, `INV-003`, `INV-004`, `INV-006`.
  - Verification: complete derivation-matrix tests, public enumeration/no-PII tests and existing-account review behavior.

- [x] T14. Implement blocked Auth provisioning and reconciliation.
  - Replace legacy invitation server actions with strict, durable `POST /api/join/provision`; begin under rate limit, create an already-banned confirmed Auth user with server-owned app metadata, record `banned_until`, commit authority/audit, then unban with `ban_duration = 'none'` and mark complete.
  - Disable public self-signup in supported environments and remove the unaffiliated signup product surface; never repurpose an existing Auth account through a public invitation.
  - Implement `/api/cron/reconcile-invitation-provisioning` with `Authorization: Bearer CRON_SECRET`, five-minute schedule, 100-row batch, two-minute eligibility and 15-minute non-PII alert.
  - Store only peppered rate-limit identifiers for 24 hours and enforce the approved source/invitation and invitation/email windows with non-enumerable errors.
  - Traceability: `REQ-002`, `REQ-003`, `REQ-004`, `REQ-006`; `INV-001`, `INV-003`, `INV-004`, `INV-006`.
  - Verification: route/cron/Auth-admin tests for every crash boundary, blocked login/no JWT, safe retry, unrelated existing account and post-commit unban recovery.

- [x] T15. Remove remaining profile writer/reader dependencies and prove compatibility.
  - Migrate every inventoried browser/session INSERT/UPDATE/DELETE/UPSERT and every protected fiscal/system read; retain only documented safe projection reads and purpose-specific server workflows.
  - Add a repository contract scan with an explicit internal-writer allowlist; no generic profile update helper is allowed.
  - Exercise onboarding, settings, fiscal, IBAN, withdrawal, invoicing, Admin people/franchises, network, invitations, Drive and invoice numbering before contract.
  - Traceability: `REQ-001` to `REQ-006`; `INV-001` to `INV-006`.
  - Verification: T2/T3 suites turn green for application commands while the staging broad grant remains temporarily compatible; no unexplained legacy call remains.

### Slice 2 exit gate

- Every profile writer and protected reader uses its designed workflow.
- Provisioning remains blocked until authority/audit commit and survives every tested crash window.
- Current valid user journeys pass before permissions are contracted.
- The authority guard compatibility metrics show no unexplained legacy authority write.

## Slice 3: Contract the profile boundary

- [x] T16. Create the final contract migration only after the Slice 2 gate.
  - Drop the broad authenticated own-profile UPDATE policy.
  - Revoke profile INSERT/UPDATE/DELETE and broad table SELECT from `PUBLIC`, `anon` and `authenticated`; regrant authenticated SELECT only for the approved directory/authority columns.
  - Tighten row policies to self, Admin and legitimate Franchise/network relationships with explicit actor-role checks; fiscal, banking and system columns stay unavailable through direct profile queries.
  - Switch the protected authority guard from compatibility mode to fail-closed in the same transaction; even direct service-role authority UPDATE without canonical context must fail.
  - Reassert function/table grants, public-wrapper revocations, private helper search paths and event/provisioning/rate-limit protections.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-005`, `REQ-006`; `INV-001` to `INV-006`.
  - Verification: migration contract, structural catalog queries and explicit negative service-role bypass test.

- [x] T17. Apply and verify the contract checkpoint on staging.
  - Apply only the reviewed contract migration after confirming the compatible staging application/reconciler is healthy.
  - Run the full effective grants/policies/function/trigger verifier and REST matrix without mocks for all roles and payload classes.
  - Run transactional authority, immutable audit, invitation/provisioning, concurrency, idempotency and crash-window suites; confirm rollback leaves no profile/event/Auth residue.
  - Regenerate remote database types, verify migration history and confirm `db push` reports staging up to date.
  - Traceability: `REQ-001` to `REQ-006`; `INV-001` to `INV-006`.
  - Verification: post-contract staging GO/NO-GO report with exact migration versions and zero broad-write/bypass findings.

### Slice 3 exit gate

- Direct authenticated profile writes are impossible.
- Direct reads expose only the approved row-scoped projection.
- Canonical commands succeed only for intended actors and create exactly one safe event.
- Rollback does not reopen the old policy or grants.

## Slice 4: Product verification and release readiness

- [x] T18. Complete privacy, observability and compatibility verification.
  - Verify allowed/denied workflow metrics, relationship/field class, safe reason/error codes and request ids without names, email, phone, fiscal data, CUPS, DNI, password or tokens.
  - Verify shared rate-limit behavior/retention, reconciler authentication/batching/alerts and the invariant that no authority mutation lacks an event.
  - Run smoke coverage for all retained personal, fiscal, banking, Admin, Franchise, invitation, pending/suspended, Drive, invoice and economic snapshot journeys.
  - Traceability: `REQ-001` to `REQ-006`; `INV-001` to `INV-006`.
  - Verification: focused tests plus sanitized logs/events inspection and unchanged fiscal/economic snapshots.

- [x] T19. Run repository, desktop/mobile and recovery gates.
  - Execute `npx tsc --noEmit`, `npm run lint`, `npm run test` and `npm run build`.
  - Run authenticated staging E2E only with documented variables; otherwise mark it skipped. Cover desktop and 390 px, dialog focus/restoration, keyboard, pending/double submit, overflow and critical/serious Axe findings.
  - Rehearse pre-contract compatible-app rollback, post-contract kill switch/forward-fix and recovery of blocked provisioning; never recreate broad grants or disable audit guards.
  - Update tasks/progress evidence and record residual risks/follow-ups without silently adding ZIN-SDD-042/043 scope.
  - Traceability: `REQ-001` to `REQ-006`; `INV-001` to `INV-006`.
  - Verification: all applicable quality gates pass and `sdd/CHECKPOINTS.md` is satisfied for staging/release readiness.

- [x] T20. Prepare the conditional production promotion package.
  - Produce an operator checklist for production preflight, expansion, compatible app, healthy reconciler/alerts, monitored checkpoint, contract, canary and forward-fix recovery.
  - Require explicit product-owner release approval before any production schema, Auth configuration, deploy or data action.
  - On approval, stop immediately on audit, provisioning, REST matrix, smoke or canary failure; archive exact versions and safe evidence.
  - Traceability: `REQ-003`, `REQ-005`, `REQ-006`; `INV-001`, `INV-003`, `INV-004`, `INV-006`.
  - Verification: reviewed release package; production remains unchanged until separate authorization.

## Completion notes

- 2026-08-03 — T1: guarded staging preflight succeeded against ref `dnzy...czny`; migrations align through `20260802110130`, PostgreSQL is `17.6`, effective access-token lifetime is 3600 seconds and production was neither queried nor mutated. Effective profile grants remain broad, signup is enabled, one Admin tuple is noncanonical, and authority/Auth guards are absent; every anomaly is classified in `profile_authority_preflight.md`.
- 2026-08-03 — T2: four focused contract suites establish 53 expected RED assertions for own identity, canonical actor/authority, invitation/provisioning and protected reader/banking boundaries. Failures are contractual `AssertionError`s only; `npx tsc --noEmit` and `git diff --check` pass. An independent adversarial review returned GO after three hardening rounds.
- 2026-08-03 — T3: the fail-closed verifier covers complete effective grants/RLS/RPC/trigger constraints, rollback-only authority and Data API write probes, a 50-case future HTTP matrix, and executable five-window Auth/reconciler fault-injection contracts with mandatory cleanup. Focused Vitest has 3 PASS plus exactly 3 intentional RED findings (missing reviewed migrations, Auth adapters and HTTP adapter); Node syntax, focused ESLint and diff checks pass. The staging runner refuses without opt-in, requires an explicit staging DB URL and contains no persistent write path. Independent adversarial review returned GO after three safety rounds.
- 2026-08-03 — T4-T5 implementation checkpoint: the single pending `20260803150000_profile_authority_expand.sql` is locally complete and unapplied. It adds the compatible authority/audit boundary, immutable safe events, neutral Auth bootstrap, blocked provisioning state machine and a durable `consume -> claim -> begin` rate-limit receipt flow. Focused migration/verifier contracts pass, including NULL fail-closed behavior, cross-domain request ids, global-first lock ordering, exact retries, invitation matrix, completion/reconciliation and 10/5 thresholds. Independent adversarial review returned GO for the local artifacts after multiple concurrency, idempotency, ACL and runner hardening rounds.
- 2026-08-03 — T6 preparation: `verify_expand_structure.sql`, `verify_expand_transactional.sql` and `verify-expand-staging.mjs` are phase-specific and ready. The runner accepts only the approved staging ref, strips libpq override environment, enforces TLS with the live `pg_stat_ssl` session, substitutes three explicit distinct fixture UUIDs, uses no `--linked`/Auth Admin operation and executes rollback-only SQL through stdin. Docker/psql execution and multi-session concurrency have not run. T4-T6 stay unchecked until staging evidence exists; production remains untouched.
- 2026-08-03 — T7-T13 compatible-app checkpoint: strict command schemas, trusted canonical actors, own-profile and onboarding commands, protected fiscal/wallet readers, a service-only own-IBAN RPC, independent subordinate-name and Admin-authority workflows, and the complete Admin/Franchise invitation UI/derivation matrix are implemented. Neutral/invalid accounts are intercepted by the proxy and shown one support/sign-out surface; no Agent or HQ fallback remains. Migration `20260803180000_add_update_own_iban_rpc.sql` was applied only to the explicit staging DB URL, its rollback-only live verifier passed, remote types include `update_own_iban`, and staging migration dry-run is up to date. Production was not queried or changed.
- 2026-08-03 — T14-T15 implementation checkpoint: the public join surface now uses durable blocked-Auth provisioning and the five-minute reconciler; unit contracts cover exact block/record/finalize/unblock/complete ordering, unrelated-account refusal, post-unban response loss and 15-minute non-PII alerts. A live staging verifier created an owned synthetic Auth user already banned, proved its exact neutral profile and absence of session/JWT, verified zero authority/provisioning/invitation references, then hard-deleted Auth/profile under its ownership marker. Legacy signup actions and the unaffiliated signup surface are removed, and local Supabase config disables signup with an eight-character minimum. On 2026-08-03, the operator disabled public signup in the approved staging dashboard and the guarded preflight confirmed `disable_signup=true`; the repeated Auth verifier returned `BLOCKED_AUTH_STAGING_OK neutral=true jwt=false cleanup=true production=false`. T14 is complete. T15 is complete: an AST inventory reports zero unexplained protected `profiles` dependencies, zero direct INSERT/DELETE/UPSERT and a strict purpose-specific allowlist; 759 non-verifier tests and the production build exercise the compatible workflows. The one HTTP/PostgREST RED remains intentionally assigned to T17 after the contract migration.
- 2026-08-03 — T16: the reviewed contract was applied only to explicit staging in `20260803190000_contract_profile_boundary.sql`. It revokes all browser profile writes, grants only the approved directory projection, replaces legacy RLS with the boolean-only canonical relationship helper, and turns the authority guard fail-closed. Effective catalog verification found and corrected two previously untracked legacy policies and added the missing tuple-shape database constraint through `20260803191000_enforce_profile_authority_tuple.sql` and `20260803192000_remove_legacy_profile_policies.sql`; history was not rewritten. Read-only structural verification returned `ok`, a rollback-only staging transaction proved both authenticated direct own-profile writes and service-role authority writes without context are denied, staging dry-run is up to date, TypeScript/lint/39 focused contracts/SDD validation and the 45-route build pass. The Supabase type generator currently requires unavailable local Docker despite no generated public type shape changing; T17 retains the real full REST matrix and type-generation follow-up.
- 2026-08-03 — T17 checkpoint: a guarded staging-only fixture provisioned one active Franchise and two direct Agents with synthetic `.invalid` identities through Auth Admin plus the audited `change_profile_authority` command; the pre-existing staging Agent provides the other-franchise case. The real Data API matrix passed for Admin, Franchise, same-network Agents, other-network Agent and anon: exact directory row scope holds, fiscal/banking/system columns are denied, and direct profile update/insert/delete attempts are denied. The post-contract blocked Auth/no-JWT verifier also passed with marker-guarded cleanup. The reusable no-mock HTTP adapter is now checked in and passes. Do not mark T17 complete yet: remote type generation remains blocked by unavailable local Docker, and its full transactional/provisioning/concurrency evidence must be retained as a distinct staging checkpoint.
- 2026-08-03 — T19 browser checkpoint: authenticated staging E2E completed with 63 passing tests and 6 intentional skips (visual snapshots, unavailable OCR path and explicitly excluded public mutation/onboarding paths). It covered Admin and Agent authentication, desktop and narrow mobile journeys, keyboard/dialog behavior and Axe accessibility assertions. Expected negative-path/dev-server connection messages did not fail the run. Production was not queried or changed.
- 2026-08-03 — T18 privacy hardening checkpoint: the authentication, session middleware and invitation surfaces no longer serialize raw provider exceptions, invitation context or recipient details to browser telemetry or UI errors. They emit only stable safe codes where server logging is appropriate, and return one non-enumerable Spanish message to the user. A static scan of the profile flow found only the safe generic “mail provider is not configured” warning. Four focused profile-authority/auth test files (21 tests), the complete suite (120 files/772 tests), ESLint, TypeScript, production build (45 routes) and diff checks pass. This is a focused flow checkpoint; the wider observability/retention review in T18 remains open.
- 2026-08-03 — T17 complete: `verify-final-transactional-staging.ps1` derives the explicit TLS staging pooler URL only from the local staging environment, validates a canonical cross-franchise fixture topology, and substitutes only technical IDs into the rollback-only final verifier. The live gate returned `STAGING_FINAL_TRANSACTIONAL_OK rollback=true production=false`: anon/authenticated/Admin direct writes were denied, the canonical authority command was atomic and idempotent, conflicting request-id reuse was denied, and audit update/delete/truncate were denied. A valid first transition and a distinct valid conflict parent are now explicit inputs, avoiding false results from an authority no-op. `verify-provisioning-staging.mjs` then created an owned, blocked, neutral Auth fixture; its rollback-only live flow passed rate receipt, claim, preparation, blocked Auth record, authority finalization/idempotent retry, completion and cleanup with `STAGING_PROVISIONING_TRANSACTIONAL_OK rollback=true cleanup=true production=false`. Its two-session node-postgres concurrency gate also passed after the contract, and both sessions rolled back. Docker Desktop was started locally and the official staging type generator completed successfully; it refreshed the full generated authority/provisioning contracts and migration dry-run reports up to date. Focused verifier contracts (7 tests), TypeScript and SDD validation pass. T17 is complete.
- 2026-08-03 — T18-T20 release-readiness closure: privacy scans retain no authority keys or PII in safe telemetry surfaces; shared rate-limit/reconciler and immutable-event checks are covered by the staging transactional/provisioning evidence, while retained personal, fiscal, banking, Admin, Franchise, Drive, invoice and economic workflows remain covered by repository and authenticated staging E2E suites. Repository gates pass: TypeScript, ESLint, full Vitest, SDD validation, diff check and a clean isolated 45-route production build. Authenticated staging E2E has 63 passes and 6 documented intentional skips. `production-promotion-checklist.md` is the reviewed conditional operator package: it requires separate product approval, uses a canary and forward-fix recovery only, and expressly forbids restoring broad profile grants. Production was not queried, deployed or changed.
- Fill remaining notes during implementation with migration versions, commands, staging evidence, skipped checks, anomalies and follow-up feature ids.
- Mark a task complete only when its verification line is satisfied.
- Move the feature to `verification` only after T1-T19 are complete. T20 preparation may be complete while production execution remains separately unauthorized.
