# ZIN-SDD-033 — OCR admin observability

## Requirements

- [REQ-001] The admin area shall expose OCR health metrics from the current `ocr_jobs` schema without requiring schema changes.
- [REQ-002] WHEN an admin opens OCR observability, the system shall show recent volume, completion rate, failure rate, processing backlog, stale processing jobs, retry pressure, and Drive archive coverage.
- [REQ-003] WHEN OCR failures exist, the system shall group frequent error causes using sanitized messages that do not expose invoice data, file names, CUPS, DNI, or customer names.
- [REQ-004] WHILE rendering the admin view, the system shall avoid selecting `extracted_data` and `file_name` for observability summaries.
- [REQ-005] IF the current user is not admin, THEN the system shall deny access through the existing server role guard.
- [REQ-006] The system shall provide a recent daily trend so admins can spot OCR degradation without opening individual jobs.

## Properties

- The feature must not add or alter database schema.
- The feature must not expose OCR extracted PII.
- The feature must be traceable through SDD docs and unit tests.
