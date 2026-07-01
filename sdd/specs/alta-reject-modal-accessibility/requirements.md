# Requirements - Alta Reject Modal Accessibility

Feature: `alta-reject-modal-accessibility`

Status: `approved`

## Intent

Hacer que el modal de rechazo de alta sea correctamente navegable y consultable por tecnologias de asistencia, sin cambiar el flujo visual ni la logica de negocio.

## Scope

In scope:

- Asociar los labels visuales del motivo y nota con sus controles.
- Declarar semantica de dialogo modal con nombre accesible.
- Ajustar pruebas de componente para consultar los campos por label.

Out of scope:

- Cambios de esquema.
- Rehacer el modal con una libreria externa.
- Cambios en permisos, RLS o acciones server.

## EARS Requirements

- [REQ-001] WHEN the reject alta modal opens, the modal shall expose a dialog role with an accessible name.
- [REQ-002] WHEN assistive technology queries the rejection reason field, the select shall be discoverable by the visible label "Motivo".
- [REQ-003] WHEN assistive technology queries the rejection note field, the textarea shall be discoverable by the visible label "Nota (opcional)".
- [REQ-004] WHEN the existing rejection flow is submitted, the action payload and success behavior shall remain unchanged.

## Properties

- [INV-001] No PII shape or persistence behavior changes.
- [INV-002] No database migration is required.
