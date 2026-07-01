# Requirements - Alta Accepted State Guards

Feature: `alta-accepted-state-guards`

Status: `approved`

## Intent

Reforzar el flujo admin de alta para que ninguna transicion de ATR pueda ejecutarse sobre propuestas que no esten aceptadas, incluso si existe drift en `alta_status`.

## Scope

In scope:

- Acciones server de alta: confirmar consentimiento, solicitar alta, completar alta, rechazar y reabrir.
- Pruebas unitarias con Supabase mock.
- Sin cambios de esquema.

Out of scope:

- Redisenar UI admin.
- Cambiar la vista `proposals_alta`.
- Cambiar notificaciones o calculo de comisiones.

## EARS Requirements

- [REQ-001] WHEN admin confirms consent, the system shall update only proposals with `status = accepted` and `alta_status = pendiente_consent`.
- [REQ-002] WHEN admin requests alta, the system shall require an accepted proposal with confirmed consent and `alta_status = lista_admin`.
- [REQ-003] WHEN admin completes alta, the system shall update only accepted proposals with `alta_status = en_alta`.
- [REQ-004] WHEN admin rejects or reopens alta, the system shall update only accepted proposals in the expected active/rejected alta states.
- [REQ-005] IF a proposal is not accepted, THEN alta mutations shall fail without writing audit events.

## Properties

- [INV-001] Alta is a sub-process of accepted proposals only.
- [INV-002] Failed alta guards do not write audit events.
- [INV-003] No schema migration is required for this guard.
