# Requirements: OCR Callback Commercial Fixture

## Status

`approved`

## Requirements

- [REQ-001] WHEN the staging OCR callback receives a completed synthetic invoice for an existing E2E agent job, the system shall update the OCR job to `completed`.
- [REQ-002] WHEN the synthetic invoice contains client identity and supply data, the system shall create or link a commercial client owned by the E2E agent franchise.
- [REQ-003] WHEN the OCR job has a selected client segment, the created client shall preserve that segment and derive the matching client type.
- [REQ-004] IF the callback fixture contains CUPS or DNI/CIF values, THEN the test shall verify persisted equality only through safe derived state and shall not require plaintext PII columns.
- [REQ-005] WHEN the fixture test finishes, the system shall clean up synthetic OCR, training, and client records from staging.

## Properties

- The fixture must refuse to run outside the known staging Supabase project.
- The fixture must require service-role credentials and webhook API key from local/CI secrets.
- The fixture must not depend on N8N availability.
