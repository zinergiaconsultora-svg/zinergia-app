# Requirements - Alta Admin Revalidation Audit

Feature: `alta-admin-revalidation-audit`

Status: `approved`

## Intent

Hacer que el panel admin de altas muestre estados e historial actualizados despues de cada transicion, sin depender de cache obsoleta.

## Scope

In scope:

- Revalidacion de rutas tras mutaciones de alta.
- Auditoria visible mediante `proposal_alta_events`.
- Tests unitarios de acciones server.

Out of scope:

- Cambios de esquema.
- Redisenar el panel admin.
- Cambios de roles/RLS.

## EARS Requirements

- [REQ-001] WHEN an alta mutation succeeds, the system shall revalidate the admin dashboard path that renders the alta pending panel.
- [REQ-002] WHEN an alta mutation succeeds, the system shall keep the existing dashboard revalidation for dependent commercial summaries.
- [REQ-003] WHEN an alta mutation fails, the system shall not write an alta audit event or revalidate stale UI paths.
- [REQ-004] WHEN admin opens alta history, the system shall read from `proposal_alta_events` ordered by newest first.

## Properties

- [INV-001] No alta transition may expose PII through audit metadata added by this change.
- [INV-002] No database migration is required.
