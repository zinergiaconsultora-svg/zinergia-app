# Requirements - Mutating Public Proposal E2E

Feature: `mutating-public-proposal-e2e`

Status: `approved`

## Intent

Cerrar el hueco de verificacion end-to-end que quedaba en staging: aceptar una propuesta publica real con firma y comprobar que se materializan los efectos de negocio principales sin tocar produccion.

## Scope

In scope:

- Fixture mutable de propuesta publica en staging.
- Reset seguro de side effects asociados al fixture.
- Playwright E2E que confirma firma y verifica propuesta aceptada, comision, tarea y contrato.
- Documentacion del opt-in requerido para pruebas destructivas de staging.

Out of scope:

- Ejecutar pruebas destructivas en produccion.
- Cambiar reglas de calculo de comisiones.
- Crear migraciones o modificar esquema.

## EARS Requirements

- [REQ-001] WHEN the staging seed refreshes the mutating public proposal fixture, the system shall reset the proposal to `sent` and remove side effects tied to that fixture proposal.
- [REQ-002] WHEN the mutating E2E is not explicitly enabled, the test shall skip instead of accepting a proposal.
- [REQ-003] WHEN the mutating E2E runs, the environment shall prove it targets the staging Supabase project before any destructive action.
- [REQ-004] WHEN the public proposal is signed in Playwright, the UI shall reach the signed confirmation state.
- [REQ-005] WHEN the public proposal is accepted, the database shall show the proposal as accepted with signature metadata.
- [REQ-006] WHEN acceptance side effects complete, the database shall contain exactly one commission, one accepted documentation task and one contract for the accepted fixture proposal.

## Properties

- [INV-001] The mutating E2E must never run against production.
- [INV-002] The test must not commit or print secret values.
- [INV-003] The read-only public proposal smoke test must remain non-mutating.
