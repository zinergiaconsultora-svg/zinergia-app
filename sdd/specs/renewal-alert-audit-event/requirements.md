# Renewal Alert Audit Event Requirements

Status: requirements approved on 2026-07-02.

## Intent

Alinear el flujo de renovaciones con la spec existente: los clientes cerrados cuya permanencia vence pronto deben entrar en la cola operativa de renovaciones y dejar un evento auditable específico en el drawer del lead.

## Requirements

- [REQ-001] WHEN the permanence reminder cron runs, the system shall detect closed leads whose permanence expires within 60 days.
- [REQ-002] WHEN a renewal reminder is sent, the system shall write a `lead_audit_events` entry with event type `renewal_alert`.
- [REQ-003] WHEN the admin opens the operational queue for renewals, the system shall filter closed-won leads whose permanence expires within the same 60-day window.
- [REQ-004] WHEN admin metrics and alert cards render, the system shall label this operational work as renewals instead of generic permanence work.
- [REQ-005] WHEN the database migration is applied, the `lead_audit_events_event_type_check` constraint shall allow `renewal_alert`.

## Properties / Invariants

- [INV-001] The audit log remains append-only for authenticated users; events are written through the server/service role path.
- [INV-002] The internal queue value `permanence_due` remains stable to avoid breaking existing URLs.
- [INV-003] The change must not expose new PII in notifications, audit details, or logs.
