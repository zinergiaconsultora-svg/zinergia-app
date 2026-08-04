# SIPS Consent and Portfolio Gate Requirements

Feature: `ZIN-SDD-043 sips-consent-and-portfolio-gate`.

Status: `requirements_ready`; SDD Gate 1 approved by the product owner on 2026-08-03.

## Intent

Close the confirmed authorization gap in annual electricity-consumption queries.
Every SIPS result, including a cached result, must require an active consent for
the requested CUPS and role-authorized access to the related client/supply. The
commercial flow must remain usable through OCR or manual input when SIPS is not
authorized or unavailable.

## Current evidence

- `src/app/api/sips/electricity/annual-consumption/route.ts` authenticates the user,
  validates and hashes CUPS, rate-limits requests and audits successful/cache/error
  outcomes.
- The route creates the service client and reads `sips_consumption_cache` before
  checking `sips_consents` or the requester's portfolio relationship.
- `sips_consents` already stores `user_id`, `client_id`, `cups_hash`, source,
  timestamp and revocation, but its current RLS only models the user's own rows.
- `supply_points` and the CRM role model provide the canonical portfolio boundary.

## Scope

In scope:

- Annual electricity-consumption SIPS route authorization.
- Active consent, canonical client/supply relationship and Admin/Franchise/Agent scope.
- Identical authorization before cache hits and CNMC requests.
- Contextual consent capture/revocation using protected CUPS equality.
- Denial, success, cache and integration-failure audit without raw PII.
- Fail-closed behavior, sanitized errors and OCR/manual fallback.
- Migration/RLS/type changes required to represent and verify the authorization contract.

Out of scope:

- Gas SIPS, interval curves, predictive scoring or new CNMC data products.
- Replacing OCR/manual annual-consumption capture.
- Backfilling or inferring consent from historical invoices, clients or contracts.
- A generic consent-management platform.
- Legal approval of consent copy, retention or expiry; these are deployment inputs from the data controller/legal owner.
- Tariff calculation changes.

## Requirements

[REQ-001] WHEN an authenticated user requests annual SIPS consumption, the system shall authorize the request before creating a service client or reading either cache or CNMC data.

Verification:

- A denied request causes no cache read, CNMC request or cache write.
- Focused tests prove authorization executes before privileged data access.
- An unauthenticated request remains `401` and does not reveal whether the CUPS is known.

[REQ-002] WHEN SIPS authorization is evaluated, the system shall require one non-revoked consent whose protected CUPS hash and client relationship match the canonical requested supply.

Verification:

- Missing consent, revoked consent, client mismatch and supply mismatch are denied.
- Equality uses `hashCups()`/`cups_hash`; raw CUPS and probabilistic ciphertext are not queried.
- No historical invoice, proposal or contract is treated as implicit consent.

[REQ-003] WHILE the requester has role `agent`, the system shall authorize only clients and supplies in that agent's portfolio; WHILE the requester has role `franchise`, it shall authorize only the franchise network's portfolio; WHILE the requester has role `admin`, it shall still require active consent even though its portfolio visibility is global.

Verification:

- Positive and negative authenticated tests cover Agent, Franchise and Admin.
- Cross-agent and cross-franchise attempts are denied.
- Role authorization is enforced on the server and supported by RLS as defense in depth.

[REQ-004] WHEN an authorized request has a valid cache entry, the system shall return it only after the same consent and portfolio checks required for a live CNMC query.

Verification:

- A cached CUPS with revoked or out-of-scope consent returns no consumption data.
- Cache hit and live-query paths share one authorization contract.
- Revocation takes effect on the next request without waiting for cache expiry.

[REQ-005] IF consent or portfolio authorization fails, THEN the system shall return a generic `403` response that does not confirm the existence of a client, supply, consent or cached result.

Verification:

- All authorization-denial cases use stable PII-safe client messages.
- Responses contain no raw CUPS, client name, internal identifiers or tenancy detail.
- The commercial UI preserves entered work and explains that OCR/manual input remains available.

[REQ-006] WHEN an authorized user records or revokes consent, the system shall bind the action to the canonical client and supply, record actor, source and time, and authorize the mutation on the server.

Verification:

- Consent cannot be recorded for an inaccessible client/supply.
- Repeated equivalent capture is idempotent or resolves to one effective active consent.
- Revocation is audited and cannot be undone by editing history; a new consent creates a new auditable fact.
- No browser write bypasses the protected server workflow.

[REQ-007] WHEN any SIPS request is accepted, denied, served from cache or fails externally, the system shall append a PII-safe audit outcome sufficient to investigate actor, authorization result, source path and time.

Verification:

- The audit supports at least authorized success, authorized cache hit, authorization denial and sanitized integration error.
- It stores only protected CUPS reference and safe reason codes; no raw CUPS or upstream free-text response is persisted.
- Audit writes do not turn a denied request into a successful response and cannot leak another user's audit rows.

[REQ-008] IF consent, portfolio or authorization storage cannot be evaluated reliably, THEN the system shall fail closed and shall not fall back to service-role access.

Verification:

- Database timeout/error tests return a safe unavailable/denied result without cache or CNMC access.
- Failures are observable through sanitized server telemetry.
- OCR/manual data entry remains available as the business fallback.

[REQ-009] WHILE SIPS authorization is enforced, the system shall preserve request validation, rate limiting, CNMC timeout/error handling and cache TTL behavior as independent controls.

Verification:

- Malformed CUPS remains `400`, missing authentication remains `401` and rate-limit responses retain `Retry-After` without revealing authorization state.
- Authorization tests cannot be bypassed through rate-limit, cache or retry paths.
- Upstream error messages are mapped to stable client messages before audit or response.

[REQ-010] WHEN this feature changes database structure, policies, functions or privileges, the system shall use a new Supabase migration, regenerate database types and verify effective access for `anon`, `authenticated` and `service_role`.

Verification:

- No dashboard schema edit or rewrite of an applied migration is used.
- Structural, transactional and role/RLS checks cover the new authorization path.
- The service-role key remains referenced only by `src/lib/supabase/service.ts`.

[REQ-011] WHEN the feature is released, the consent prompt and denial recovery shall remain contextual to the client/supply or comparison flow and shall not add a primary navigation entry.

Verification:

- The user does not re-enter client or CUPS data already present in the canonical context.
- One clear primary action is visible; legal detail is progressively disclosed.
- Desktop and 390 px checks show no horizontal overflow, keyboard traps or critical/serious accessibility findings.

[REQ-012] WHEN deployment begins, the system shall not infer consent for existing records and shall provide a safe kill path that disables live SIPS access without reopening unauthorized reads.

Verification:

- A pre-deployment report counts consent-covered and uncovered supplies without raw CUPS output.
- Rollback never restores the current unguarded behavior; OCR/manual remains the continuity path.
- Any schema rollout follows expand/verify/contract and preserves audit history.

## Properties / Invariants

- [INV-001] No cache or CNMC SIPS consumption is returned without active consent and role-authorized portfolio access.
- [INV-002] Cache authorization is never weaker than live-query authorization.
- [INV-003] Revocation takes precedence over cache freshness and previous successful queries.
- [INV-004] Admin visibility never substitutes for customer consent.
- [INV-005] Consent is explicit; historical business records never imply it.
- [INV-006] Raw CUPS never appears in database audit, logs, metrics, errors or test fixtures.
- [INV-007] Privileged access occurs only after server authorization and never from browser writes.
- [INV-008] Authorization uncertainty fails closed while OCR/manual capture remains available.
- [INV-009] Every schema or RLS change is migration-backed and type-regenerated.
- [INV-010] Consent history and request audit are append-only for evidentiary events.

## Success criteria

- The role/consent matrix passes for live, cached, revoked, cross-tenant and storage-failure paths.
- One hundred percent of SIPS data responses have an auditable successful authorization decision.
- One hundred percent of denials produce no data read from cache/CNMC and no raw PII in client or server observability.
- The normal commercial journey continues through contextual consent, OCR or manual input without a new module.
- Focused tests plus TypeScript, lint, unit suite and production build pass; authenticated desktop/mobile verification covers the changed journey.

## Product decisions proposed for approval

- SIPS consent is specific to one canonical client and supply/CUPS, not a broad account-level permission.
- Admin and franchise oversight do not waive the active-consent requirement.
- The first slice records actor, source and timestamp; it does not require a new signature/document upload unless the data controller mandates one.
- Existing records receive no inferred consent.
- OCR/manual capture is the continuity and rollback path.

## Open deployment inputs

- Final consent wording and proof standard approved by the data controller/legal owner.
- Consent retention and whether an explicit expiry is required in addition to revocation.
- Approved safe reason-code taxonomy and audit-retention period.
