# Public Proposal Acceptance Security Requirements

Status: requirements approved on 2026-06-30. Design is ready for review.

## Intent

Endurecer el flujo publico de propuestas para que un cliente pueda aceptar de forma sencilla, mientras el sistema evita abuso, doble envio, payloads manipulados y exposicion de datos sensibles.

## Scope

In scope:

- Acceso publico a propuesta por token.
- Validacion de aceptacion y firma.
- Rate limiting and abuse protection.
- Estados de propuesta aceptada, expirada, invalida o ya procesada.
- Auditoria minima del evento de aceptacion.
- Mensajes de error sin PII.

Out of scope:

- Redisenar el PDF de propuesta.
- Cambiar el motor de comparacion de tarifas.
- Cambiar calculo de comisiones.

## Requirements

[REQ-001] WHEN a public user opens a proposal token, the system shall return only the proposal data required for review and shall not expose internal agent, franchise or service-role details.

Verification:

- Public proposal action/route test asserts response shape excludes internal fields.

[REQ-002] IF the proposal token is missing, invalid, expired or revoked, THEN the system shall reject access with a generic error that does not reveal whether a client, CUPS or DNI exists.

Verification:

- Tests cover missing, invalid and expired token states.

[REQ-003] WHEN a public user submits acceptance, the system shall validate the token, proposal state, signature payload and required acceptance fields before writing any acceptance result.

Verification:

- Tests cover malformed signature payload and missing required fields.

[REQ-004] IF the same proposal acceptance is submitted more than once, THEN the system shall avoid duplicate acceptance side effects and return a stable already-processed result.

Verification:

- Test double-submit behavior against existing accepted proposal state.

[REQ-005] WHILE the public acceptance endpoint is available, the system shall apply rate limiting or equivalent abuse protection before expensive or state-changing work.

Verification:

- Test or manual verification proves repeated requests are limited or rejected.

[REQ-006] WHEN acceptance succeeds, the system shall persist an audit record sufficient to trace proposal id, event time and acceptance outcome without logging sensitive PII to client-visible errors.

Verification:

- Test confirms accepted state and audit/event record where the existing schema supports it.

[REQ-007] IF acceptance validation fails, THEN the system shall not change proposal state, create commission effects or emit misleading success feedback.

Verification:

- Negative tests assert proposal state remains unchanged after invalid payloads.

## Properties / Invariants

- [INV-001] Public proposal acceptance shall never require service-role access in client-side code.
- [INV-002] Public error messages shall not include CUPS, DNI, full address or raw database errors.
- [INV-003] Acceptance shall be idempotent for already accepted proposals.
- [INV-004] No schema change may be made without a migration in `supabase/migrations/`.

## Open Questions

- What is the current canonical accepted state for proposals in the database?
- Is there an existing audit/activity table for public proposal acceptance events?
- What rate limiting helper is already used in this codebase for public proposal routes?
