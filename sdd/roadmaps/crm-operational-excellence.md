# CRM Operational Excellence Roadmap

Status: proposal for SDD Gate 1 approval.

Date: 2026-08-03.

## Executive decision

Zinergia shall evolve the delivered CRM core instead of copying the competitor's
module count. The target experience is one guided operating system for energy
sales: one client, one supply point, one opportunity, one accountable next action
and one visible path from invoice to validated commission.

This roadmap is deliberately not an implementation feature. Each delivery unit
below requires its own requirements approval, design approval, ordered tasks and
PR. Only one feature may be `in_progress` at a time.

## Evidence baseline

### Already delivered and not to be rebuilt

- Invoice OCR, human review, tariff comparison and proposal preparation.
- Canonical clients, supply points and opportunities.
- Public proposal acceptance, activation, active contract and renewal at 60 days.
- `Trabajo` queue grouped into overdue, today, upcoming and no-date work.
- Client and opportunity workspaces with one owner, stage and next action.
- Commission lifecycle, allocation ledger, decommission, fiscal invoicing and reconciliation.
- Role-aware primary navigation, RLS, encrypted CUPS/DNI and audited server transitions.

The approved source is `sdd/specs/crm-core-flow-simplification/`.

### Confirmed gaps

| Gap | Repository evidence | Consequence |
|---|---|---|
| Profile authority boundary | The versioned `profiles` self-update policy is row-scoped but does not constrain protected columns; effective Data API grants still require linked-database verification. | If update privileges are effective, a user could attempt to change role, hierarchy or franchise attributes on their own row. |
| OCR PII at rest | OCR callback and actions persist `cups` and `dni_cif` inside `ocr_jobs.extracted_data`; the existing `encryptJson()` helper is not used on these paths. | Protected identifiers can exist in clear JSON despite the application encryption invariant. |
| OCR tenant boundary | Versioned OCR policies allow rows sharing `franchise_id` to be selected/updated without proving the requester is the franchise supervisor. | An agent may gain lateral access to another agent's OCR data inside the same franchise. |
| SIPS authorization | `src/app/api/sips/electricity/annual-consumption/route.ts` reads cache or CNMC after authentication but does not enforce `sips_consents` or portfolio membership. | A user can request a valid CUPS outside the intended consent and tenancy boundary. |
| Direct domain writes | Active browser services insert/update/delete `contracts` and `tasks`; contract policy permits own-row management. | Critical state can bypass server guards, canonical transitions, audit and side effects. |
| Parallel work sources | `agendaToday.ts` and `generate-actions` use `next_actions`; task UI still writes `tasks`; renewal actions still use `renewal_opportunities`. | Users can receive contradictory agendas despite canonical `opportunities.next_action_*`. |
| Work queue ceiling | `src/app/actions/workQueue.ts` limits the canonical queue to 200 rows. | Supervisors can silently miss work at scale. |
| Tariff identity mismatch | The importer conflict key differs from the database uniqueness contract. | Reimports may collide incorrectly or duplicate legitimate variants. |
| Catalog mutation authority | `offers.ts` permits Admin/Franchise mutation while `tariffs.ts` is Admin-only over the same catalog surface. | Authorization and versioning depend on which legacy action is called. |
| Catalog query shape | The simulator loads active tariffs before applying the full calculation. | Large catalogs can truncate, slow down or rank an incomplete candidate set. |
| Operational exceptions | There is no single Case aggregate with type, owner, SLA, evidence and resolution. | Incidents, requests and technical exceptions are fragmented. |
| External states | No raw provider status and versioned mapping layer is present. | Provider-specific vocabulary can leak into the canonical workflow or require manual interpretation. |
| Supplier statements | Statement tables exist, but ingestion and matching workflows do not. | Reconciliation remains incomplete and manual. |

### Hypotheses that must not be presented as facts

- The production tariff catalog size and its future ingestion SLA.
- Which providers expose stable APIs and justify a connector.
- The initial Case taxonomy and contractual SLAs.
- The real formats and match quality of supplier statements.
- Whether efficiency already has an owner, margin model and delivery process.

## Product rules

1. Complexity stays in the domain model; each screen exposes one primary action.
2. New capabilities reuse canonical objects and appear in existing workspaces.
3. Process work has one canonical next action; ad-hoc work cannot create a second pipeline.
4. Exceptional work becomes a typed Case, not a new top-level module per exception.
5. External provider state is preserved raw and mapped; it never becomes the commercial state directly.
6. Money and accepted proposal snapshots are immutable; corrections are append-only.
7. Every cutover expands first, reconciles, observes and contracts later.
8. No feature adds primary navigation unless it consolidates or removes an existing entry.

## Outcome model

Recommended north-star metric, pending business approval:

- **Validated commission per active commercial per month.**

Leading indicators:

- Median invoice-to-first-proposal time after successful OCR.
- Percentage of critical data reused without re-entry.
- Percentage of open opportunities with one coherent next action.
- First-time-right activation rate.
- Case p50/p90 resolution time and SLA compliance.
- Renewal contact coverage at 60/30/7 days.
- Percentage of known external statuses mapped.
- Automatic supplier-statement match rate on approved representative fixtures.

Guardrails:

- Zero self-service changes to role, hierarchy, franchise or protected economic authority.
- Zero clear CUPS/DNI in persisted OCR JSON and zero sibling-agent OCR access.
- Zero SIPS reads without active consent and portfolio authorization.
- Zero active duplicate opportunities or renewal records for the same commercial cycle.
- Zero ambiguous automatic settlements.
- No deterioration in early churn or confirmed decommission rate.
- Zero CUPS, DNI, proposal tokens or signatures in logs, queues or telemetry.
- Zero critical/serious accessibility regressions in changed critical journeys.

Economic and SLA targets require a production baseline before numerical targets
are committed. Security and integrity guardrails do not wait for a baseline.

## Delivery sequence

Proposed IDs after ZIN-SDD-043 are reservations for sequencing only. They enter
`feature_list.json` one at a time when their requirements work begins.

### Wave P0 — integrity before expansion

| Order | Proposed feature | Size / risk | Result and acceptance boundary | Depends on |
|---:|---|---|---|---|
| 041 | `profile-authority-hardening` | M / critical | Effective grants are verified; self-service profile updates use an explicit safe-column allowlist; authority/hierarchy changes require an audited Admin workflow. | None |
| 042 | `ocr-pii-and-tenant-boundary` | L / critical | Persisted OCR data contains no clear CUPS/DNI; Agent sees own, Franchise its network, Admin global; existing clear records are safely remediated. | 041 |
| 043 | `sips-consent-and-portfolio-gate` | M / critical | Consent and role scope are checked before cache or CNMC; denied paths are audited without PII; OCR/manual remains available. | 041, 042 |
| 044 | `ocr-webhook-authenticity-and-minimization` | M / critical | Callback is bound to job and payload with signature, timestamp/replay protection, size/schema limits and minimum required data. | 042 |
| 045 | `contract-server-command-cutover` | M / critical | Contract UI uses authorized server commands and canonical transition rules; existing rows remain compatible. | 041 |
| 046 | `task-server-command-cutover` | M / high | Existing task UI uses authorized server commands; current rows remain compatible. | 041 |
| 047 | `critical-browser-write-revocation` | S-M / critical | Direct browser writes to contracts/tasks are revoked only after 045/046 pass authenticated and REST-bypass verification. | 045, 046 |
| 048 | `legacy-next-actions-cutover` | M / high | Cron and active reads stop using `next_actions`; unrepresentable rows enter a read-only report. No table drop. | 046 |
| 049 | `legacy-renewal-cutover` | M / high | Actions, alerts and metrics use `opportunities(type=renewal)` and canonical reminders. Ambiguous legacy rows are not guessed. | 045 |
| 050 | `work-queue-pagination` | S-M / medium | Stable cursor pagination exposes all authorized work beyond 200 rows without changing workflow states. | 048, 049 |
| 051 | `catalog-mutation-authority-convergence` | S-M / high | One Admin-only versioned workflow replaces contradictory offer/tariff mutations; accepted snapshots remain immutable. | 041 |
| 052 | `tariff-variant-identity` | M / high | One versioned business identity is shared by import code, database constraint and tests; historical proposal snapshots are untouched. | 051 |
| 053 | `eligible-tariff-query` | L / high | Server-side eligibility and pagination select the complete candidate set before the existing calculation engine runs. | 052 |

P0 acceptance as a program:

- REST/Data API tests prove users cannot elevate their own authority, access sibling OCR rows or directly mutate critical domain state.
- Canary scans find no clear CUPS/DNI in OCR tables, JSON, logs, events or fixtures after remediation.
- The daily workflow has one authoritative process queue.
- The SIPS authorization gap is closed without inventing historical consent.
- A 50,000-variant synthetic catalog produces no truncation or identity collision;
  eligible-query p95 is below one second in the agreed staging profile.
- No P0 PR removes its legacy source in the same release that introduces the replacement.

### Wave P1 — professional operations

| Order | Proposed feature | Size / risk | Minimum scope | Depends on |
|---:|---|---|---|---|
| 054 | `playbook-template-foundation` | M / high | Versioned templates, triggers and steps; no automatic execution yet. | 048 |
| 055 | `playbook-work-item-execution` | L / high | Idempotent runs expose only the current actionable step through canonical work. | 050, 054 |
| 056 | `operations-case-foundation` | L / high | One typed Case with canonical links, owner, SLA, severity, conversation, evidence and resolution. | 050 |
| 057 | `case-work-queue-projection` | M / high | Due and overdue cases appear in `Trabajo`/`Operaciones`; no second agenda. | 056 |
| 058 | `provider-status-normalization` | L / high | Raw value, source, time and reference are preserved and version-mapped to the five canonical activation states; unknown values create review. | 056 |
| 059 | `document-metadata-index` | M / high | Existing Storage/Drive resources gain authorized facets for marketer, client, supply, opportunity, contract and category. Files are not physically reorganized. | 042 |
| 060 | `document-search-surface` | M / medium | Search and contextual recommendations reuse the metadata index and existing workspaces. | 059 |
| 061 | `supplier-statement-ingestion` | M / high | Admin imports are validated, idempotent and traceable to a source batch; invalid rows do not mutate money. | Current ledger |
| 062 | `supplier-statement-matching` | L / critical | Suggestions separate exact, ambiguous and rejected matches; ambiguous lines require confirmation and Case linkage. | 056, 061 |

P1 acceptance as a program:

- At least 95% of configured standard steps are generated without manual task creation.
- Every open Case has an owner and SLA or an explicit approved exception.
- Every known provider value maps to a versioned canonical value; unknown values never advance the operation.
- Reimporting a supplier statement is idempotent and representative fixtures reach the approved match threshold without automatic ambiguous settlement.

### Wave P2 — conditional differentiation

| Proposed feature | Entry condition | Thin outcome |
|---|---|---|
| `contextual-commercial-knowledge` | P1 metadata/search proves adoption. | Evolve `academy_resources` with marketer/product/role/validity facets and surface only contextual guidance. |
| `renewal-and-loss-intelligence` | Legacy renewals are retired and event telemetry has a stable baseline. | Explainable prioritization on canonical renewal opportunities plus normalized loss reasons; no automatic outcome decisions. |
| `efficiency-opportunity-validation` | Named owner, repeatable service, margin model and delivery process are approved. | An accepted efficiency recommendation creates a linked opportunity; it does not create a generic project-management product. |
| Individual provider connectors | Contract, sandbox, SLA and business owner exist for that provider. | One connector per SDD feature, feeding the normalization layer. |

## Expand/contract and rollback policy

- **Profile authority:** verify linked grants first, add explicit safe update boundaries, prove Admin workflow compatibility and only then contract broad privileges. Rollback must not reopen self-authority changes.
- **OCR PII and isolation:** introduce encrypted/sanitized representation and dual-read only for a bounded migration window; remediate clear historical values with a timestamped repair process and canary verification before removing legacy reads.
- **Task writes:** deploy server commands first; revoke browser writes only after authenticated verification. A rollback of the second step is forward-fix, not a silent reopening of broad privileges.
- **Legacy action sources:** stop writers and readers, reconcile, retain read-only data for an agreed observation window, then propose a separate drop feature.
- **Renewals:** classify legacy rows as linkable, duplicate, closed or ambiguous. Never auto-link ambiguity.
- **Tariff identity:** add the new identity, backfill and verify before constraining it; keep previous index until production evidence is clean.
- **Catalog query:** preserve the existing calculation engine and compare ranking against the complete eligible set. Roll back the read path, not historical prices.
- **Provider and statement data:** ingestion is append-only and idempotent; corrections create new events or reviewed mappings.

## Quality gates for every child feature

- Requirements in EARS format with role-specific positive and negative verification.
- Design covering files, data model, migration, RLS, privacy, test and rollback.
- New schema only through `supabase/migrations/` plus regenerated `database.types.ts`.
- Mutations only after `requireServerRole`/`requireRouteRole`; service role remains confined to the approved module.
- Focused unit/integration tests plus `npx tsc --noEmit`, `npm run lint`, `npm run test` and `npm run build` proportional to risk.
- Authenticated desktop and 390 px checks for changed journeys: no horizontal overflow, usable keyboard order, visible focus, accessible names and no critical/serious Axe findings.
- External integrations include timeout, sanitized errors, retry/idempotency and failure-path tests.
- Security-boundary features include direct REST/Data API negative tests across anon, two agents in the same franchise, another franchise, Franchise and Admin, plus effective grant/policy inspection on the linked staging database.
- PII features include canary scans of columns, JSON, logs and events; authorized decrypt-boundary, rotation and erasure behavior are verified without printing secrets.
- No feature moves to `in_progress` until requirements and design have each passed their approval gate.

## Explicit non-goals

- A second dashboard, agenda, client file, renewal pipeline or commission system.
- Separate Incidence and Request modules; they are Case types.
- A monolithic 20-state opportunity.
- A materialized Cartesian catalog copied from a competitor row count.
- A new Prefactura entity.
- A generic calendar, campaign suite, map, ITSM or project-management product.
- Physical Drive reorganization before metadata indexing proves value.
- Automatic accounting decisions from uncertain statement matches.
- Advanced gas SIPS, load curves or predictive scoring in P0/P1.
- New authentication roles or primary-navigation entries merely to mirror the competitor.

## Decisions required at the appropriate child gate

1. Whether the north star is validated or paid commission per active commercial.
2. Consent evidence, wording, retention and expiry policy approved by the data controller/legal owner.
3. The initial Case types, severity matrix and SLAs covering the observed 80% of exceptions.
4. The first provider with a stable state contract and operational owner.
5. Representative supplier-statement files and the acceptable assisted-match threshold.
6. The canonical tariff-variant identity dimensions and source-update SLA.
7. Whether ad-hoc tasks may become an opportunity's next action or remain secondary work only.

## Blocking P0 requirements

- [P0-REQ-001] WHEN a user updates their own profile, the system shall allow only explicitly approved self-service fields and shall reject role, hierarchy, franchise, authority, fiscal-verification or economic-assignment changes outside an authorized Admin workflow.
- [P0-REQ-002] WHEN OCR data is persisted or emitted, the system shall encrypt protected identifiers, use blind indexes for equality and exclude clear CUPS/DNI from JSON, logs, errors, events, metrics and training data.
- [P0-REQ-003] WHILE OCR data is accessed, the system shall enforce Agent-own, Franchise-network and Admin-global scope even through direct REST/Data API calls.
- [P0-REQ-004] WHEN a contract, task, opportunity stage, owner, outcome or next action changes, the system shall use an authorized server command/RPC, validate the transition and append an immutable audit event; the browser shall have no direct critical-write privilege.
- [P0-REQ-005] WHEN SIPS data is requested, the system shall require identity, active consent and authorized portfolio scope before cache or provider access.
- [P0-REQ-006] WHEN N8N calls the OCR callback, the system shall validate job-bound authenticity, timestamp/replay window, body limit, strict schema and idempotency, and shall minimize outbound/inbound fields by purpose.
- [P0-REQ-007] WHEN tariff/catalog data is mutated, the system shall use one Admin-only versioned workflow and shall preserve every accepted proposal snapshot.

## Gate 1 approval requested

Approval of this roadmap authorizes only the ordered SDD discovery/design cycle.
It does not authorize code, schema, production data or external-provider changes.
The first implementation candidate is ZIN-SDD-041. Three blocking security
requirements drafts are ready in `sdd/specs/profile-authority-hardening/`,
`sdd/specs/ocr-pii-and-tenant-boundary/` and
`sdd/specs/sips-consent-and-portfolio-gate/`.
