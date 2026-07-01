# Requirements - Accepted Follow-up Idempotency Guard

Feature: `accepted-followup-idempotency-guard`

Status: `approved`

## Intent

Cerrar la brecha restante del flujo propuesta aceptada -> efectos comerciales: si el finalizador se reintenta para una propuesta ya aceptada, no debe crear tareas duplicadas de documentacion.

## Scope

In scope:

- Tareas auto-generadas al aceptar una propuesta.
- Idempotencia del finalizador compartido usado por aceptacion publica y autenticada.
- Pruebas unitarias enfocadas.

Out of scope:

- Cambios de esquema.
- Cambios de UI.
- Cambios de calculo de comisiones o contrato.

## EARS Requirements

- [REQ-001] WHEN accepted side effects run for a proposal, the system shall create at most one pending auto-generated documentation task for that proposal.
- [REQ-002] IF an accepted documentation task already exists for the proposal, THEN the system shall skip inserting another documentation task.
- [REQ-003] WHEN sent proposal follow-up tasks are generated, the existing 3-day and 7-day follow-up behavior shall remain unchanged.
- [REQ-004] IF the idempotency lookup fails, THEN acceptance shall remain non-blocking and avoid leaking PII in errors.

## Properties

- [INV-001] Acceptance side effects remain safe to retry.
- [INV-002] No public token, signature payload, CUPS or DNI is logged by this change.
- [INV-003] No database schema change is introduced.
