# Requirements - Acceptance Side Effects Idempotency

Feature: `acceptance-side-effects-idempotency`

Status: `approved`

## Intent

Revisar el tramo final del flujo OCR -> propuesta -> firma -> comision para que una aceptacion de propuesta ejecute los efectos comerciales exactamente una vez por intento efectivo, sin duplicar tareas ni dejar divergencias entre aceptacion autenticada y publica.

## Scope

In scope:

- Acceptance side effects triggered by `updateProposalStatusAction(..., 'accepted')`.
- Regression coverage for commission/lead/task/contract side effects.
- SDD documentation and verification.

Out of scope:

- Changing public token security or signature validation.
- Adding schema or Supabase migration changes.
- Running destructive acceptance tests against production.

## EARS Requirements

- [REQ-001] WHEN an authenticated proposal status update transitions a proposal to `accepted`, the system shall execute the shared acceptance finalizer exactly once.
- [REQ-002] WHEN the shared finalizer creates accepted follow-up work, the authenticated status action shall not create a duplicate accepted task after the finalizer returns.
- [REQ-003] WHEN acceptance side effects run, commission creation shall remain idempotent through the existing proposal-level commission guard.
- [REQ-004] IF non-critical side effects fail, THEN the proposal acceptance shall remain accepted and emit only non-PII diagnostics.
- [REQ-005] WHEN public acceptance uses the shared finalizer, this change shall not weaken token validation, signature validation, rate limiting, or safe public reads.

## Properties

- [INV-001] A proposal acceptance must not create duplicate documentation tasks from the same acceptance path.
- [INV-002] No `SUPABASE_SERVICE_ROLE_KEY` usage may be introduced outside the existing service helper.
- [INV-003] No CUPS, DNI, signature payload, or public token may be written to logs or activity metadata by this change.
