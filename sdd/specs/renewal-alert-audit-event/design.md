# Renewal Alert Audit Event Design

Status: design approved on 2026-07-02.

## Summary

Use the existing `permanence-reminders` cron as the canonical detection path for renewal timing. It already queries closed leads with `permanence_until`, notifies the assigned agent/admins, writes audit history, and marks the lead as reminded. Expand its window from 30 to 60 days and change the audit type from a generic `note_added` to `renewal_alert`.

## Affected Files

- `src/app/api/cron/permanence-reminders/route.ts`
- `src/lib/audit/leadAuditLog.ts`
- `src/app/actions/invoices.ts`
- `src/features/admin/leads/*`
- `supabase/migrations/20260702111026_renewal_alert_audit_event.sql`
- `docs/SPEC-renovaciones.md`

## Data Model

The migration drops and recreates `lead_audit_events_event_type_check` with the existing event types plus `renewal_alert`. It also replaces the `get_lead_metrics()` and `get_lead_analytics()` function bodies so aggregated renewal counts use 60 days.

## Behavior

- Cron detection uses `REMINDER_WINDOW_DAYS = 60`.
- The lead drawer shows the new event because it already renders events from `lead_audit_events` by `job_id`.
- Admin queue URLs keep using `queue=permanence_due`, while labels and empty copy say "Renovaciones".
- The `LeadMetrics` response key changes from `permanence_due_30` to `permanence_due_60`.

## Verification

- Focused cron unit test for the 60-day SQL boundary and `renewal_alert` write.
- Existing admin invoices test updated from 30-day to 60-day boundary.
- SDD validation, typecheck, lint, tests, and build.
