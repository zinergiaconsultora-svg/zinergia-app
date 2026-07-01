# Requirements - Staging Migration History Reconciliation

Feature: `staging-migration-history-reconciliation`

Status: `approved`

## Intent

Eliminar la deriva operativa descubierta durante los E2E de propuesta publica: staging tenia esquema parcialmente atrasado y `supabase db push` no era fiable por historial remoto antiguo. El objetivo es dejar un diagnostico reproducible y, si es seguro, reparar el historial de staging sin tocar produccion.

## Scope

In scope:

- Auditar migraciones locales, proyecto linked y staging.
- Documentar diferencias entre historial remoto y archivos locales.
- Reparar solo staging si las diferencias son historiales legacy ya absorbidos por `20260420000000_baseline.sql`.
- Verificar `migration list`, `db push --dry-run` y flujos de seed/E2E.

Out of scope:

- Reparar produccion sin una aprobacion especifica posterior.
- Cambiar datos reales de negocio.
- Crear nuevas tablas o cambiar modelo funcional.

## EARS Requirements

- [REQ-001] WHEN auditing migrations, the system shall compare local migration versions with remote `supabase_migrations.schema_migrations` for linked and staging targets.
- [REQ-002] IF remote versions are not present locally, THEN the system shall classify them as legacy, missing-source, or unsafe before any `migration repair`.
- [REQ-003] WHEN a repair is applied, it shall target staging only and record the exact versions and status changes.
- [REQ-004] WHEN repair completes, `supabase migration list` for staging shall no longer report remote-only legacy versions.
- [REQ-005] WHEN repair completes, `supabase db push --dry-run` for staging shall not fail because of remote migration versions missing locally.
- [REQ-006] WHERE schema drift remains after history repair, the system shall report it separately from migration-history drift.
- [REQ-007] The project shall document the recovery procedure so future schema changes follow migration files, type generation and tests.

## Properties

- [INV-001] Production migration history must remain read-only in this feature.
- [INV-002] No Supabase passwords, tokens or service keys may be committed or printed.
- [INV-003] Manual staging SQL must be represented as operational scripts or migration history notes, not hidden chat state.
