# Commission Split Hardening Requirements

Status: requirements approved on 2026-06-30. Design is ready for review.

## Intent

Blindar el calculo y registro de comisiones para que una propuesta aceptada genere exactamente una comision correcta, consistente y trazable, independientemente de si la aceptacion viene del enlace publico o de una accion autenticada del dashboard.

## Current Observations

- The pure calculator lives in `src/lib/commissions/calculator.ts` and already has unit tests.
- Commission creation logic is duplicated in `src/app/actions/publicProposal.ts` and `src/app/actions/proposals.ts`.
- Accepted public proposals create commissions with service role and `upsert(... onConflict: 'proposal_id', ignoreDuplicates: true)`.
- Authenticated proposal status changes use session Supabase client and also upsert commissions.
- Tariff fixed commission from `offer_snapshot.estimated_agent_commission` currently overrides savings-based calculation.
- Per-franchise `royalty_percent` is applied differently depending on whether the source is a fixed tariff commission or legacy savings split.

## Scope

In scope:

- Single shared domain/service path for computing and recording network commissions.
- Consistent behavior between public acceptance and authenticated `accepted` status updates.
- Idempotency when a proposal is accepted more than once or two requests race.
- Correct handling of tariff fixed commission vs savings-based fallback.
- Correct handling of `franchise_config.royalty_percent`.
- Tests for pure calculation and server-action integration boundaries.
- No PII in commission errors, logs or metadata.

Out of scope:

- Redesigning wallet UI.
- Changing invoice payout or withdrawal workflows.
- Introducing a new commission product model.
- Backfilling historical commissions unless a defect is discovered and explicitly approved.

## Requirements

[REQ-001] WHEN any proposal transitions to accepted, the system shall attempt to create one and only one `network_commissions` row for that proposal.

Verification:

- Tests cover public acceptance and authenticated status update paths.
- Tests cover already accepted or duplicate calls without duplicate commission inserts.

[REQ-002] WHEN a proposal offer includes a positive `offer_snapshot.estimated_agent_commission`, the system shall use that value as the agent base commission before applying the franchise royalty rule.

Verification:

- Unit test confirms tariff fixed commission path.

[REQ-003] WHEN a proposal offer does not include a positive fixed tariff commission, the system shall calculate commissions from `annual_savings` using the active commission rule.

Verification:

- Unit test confirms savings-based fallback path.

[REQ-004] WHEN a franchise has an active `franchise_config.royalty_percent`, the system shall apply that override consistently across all commission creation paths.

Verification:

- Tests cover `royalty_percent` null, 0, positive and 100.

[REQ-005] IF commission creation fails after a proposal is accepted, THEN the system shall not roll back the accepted proposal but shall log/report enough non-PII context to reconcile the commission later.

Verification:

- Test confirms accepted flow returns success or keeps accepted state while commission failure is captured.

[REQ-006] WHERE a proposal has no agent, no franchise, or insufficient data to create a commission, the system shall skip commission creation safely and emit non-PII diagnostic context.

Verification:

- Tests cover missing agent/franchise and missing annual savings/fixed commission cases.

[REQ-007] WHEN commission state is read or changed from dashboard actions, the system shall enforce role boundaries for Admin, Franchise and Agent according to existing RLS and `requireServerRole`.

Verification:

- Tests or design review confirm mutating commission actions call `requireServerRole` before DB writes.

[REQ-008] WHEN a commission is created, the persisted monetary values shall be rounded to cents and never negative.

Verification:

- Unit tests cover rounding and negative/invalid input rejection.

[REQ-009] IF concurrent acceptance requests attempt to create the same commission, THEN the database uniqueness constraint and application code shall keep the operation idempotent.

Verification:

- Tests assert `onConflict: 'proposal_id'` / equivalent idempotency remains in place.

## Properties / Invariants

- [INV-001] A proposal may have at most one active `network_commissions` row created by acceptance.
- [INV-002] Commission creation shall not expose CUPS, DNI, public tokens, signatures or raw proposal payloads in logs or errors.
- [INV-003] Public acceptance and authenticated acceptance shall use the same commission calculation semantics.
- [INV-004] Admin/franchise commission lifecycle actions shall authorize before writing.
- [INV-005] Any schema change required for commission hardening shall be implemented through `supabase/migrations/` and regenerated types.

## Open Questions

- Should fixed tariff commission represent the agent gross commission before royalty, or the final agent amount after franchise royalty? Current code treats it as agent gross before franchise royalty in effect, by giving the agent the fixed amount and calculating franchise commission on top.
- Should a missing franchise prevent commission creation entirely, or create an agent-only commission with `franchise_id = null` if the schema allows it?
- Is `proposal_id` currently unique in `network_commissions` in the baseline schema, or is idempotency relying only on application-level `upsert` assumptions?
