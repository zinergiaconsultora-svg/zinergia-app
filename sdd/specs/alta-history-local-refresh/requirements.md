# Requirements - Alta History Local Refresh

Feature: `alta-history-local-refresh`

Status: `approved`

## Intent

Hacer que el expediente de alta muestre su historial actualizado inmediatamente despues de una accion admin exitosa, incluso antes de que el panel padre termine de refrescar.

## Scope

In scope:

- Recarga local de `proposal_alta_events` tras mutaciones exitosas desde `ExpedienteAlta`.
- Cobertura de componente para el contador visible de historial.

Out of scope:

- Cambios de esquema.
- Cambios de RLS o roles.
- Rediseno visual del expediente.

## EARS Requirements

- [REQ-001] WHEN an admin alta action succeeds from `ExpedienteAlta`, the component shall reload alta events for the current proposal.
- [REQ-002] WHEN the local event reload completes, the visible history count shall reflect the latest returned events without requiring a parent prop change.
- [REQ-003] WHEN an admin alta action fails, the component shall keep the existing error toast behavior and shall not call the parent refresh callback as a success.
- [REQ-004] WHEN the event reload fails, the component shall fail closed by rendering no stale event list.

## Properties

- [INV-001] No audit metadata or PII shape changes are introduced.
- [INV-002] No database migration is required.
