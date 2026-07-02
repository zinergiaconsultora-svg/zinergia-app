# ZIN-SDD-033 — Design

## Scope

Create an admin-only observability page for OCR operations using existing data in `public.ocr_jobs`.

## Data Access

- Add `getOcrObservabilityAction()` under `src/app/actions/`.
- Guard with `requireServerRole(['admin'])`.
- Query only operational columns:
  - `id`
  - `status`
  - `created_at`
  - `updated_at`
  - `attempts`
  - `error_message`
  - `agent_id`
  - `drive_synced_at`
  - `compared_at`
- Explicitly do not select `extracted_data`, `file_name`, `file_path`, CUPS, DNI, customer names, or invoice contents.

## Metrics

- Last 24 hours: volume, completed, failed, processing, completion rate.
- Last 7 days and 30 days: volume and failure rate.
- Backlog: current processing jobs and stale processing jobs older than 15 minutes.
- Retry pressure: jobs with more than one attempt.
- Drive coverage: completed jobs archived in Drive.
- Conversion readiness: completed jobs that have reached comparison.
- Frequent errors: normalized and sanitized error buckets.
- Daily trend: created/completed/failed counts by day for the last 14 days.

## UI

- Add `/admin/ocr`.
- Add an admin nav entry.
- Render a server page that passes data to a focused presentational component.
- Use compact operational styling consistent with the admin tools.

## Security

- Server role guard is mandatory.
- No service role is needed.
- No schema changes or migrations.
- Failure messages are normalized before rendering.
