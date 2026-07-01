# Design: OCR Callback Commercial Fixture

## Overview

Add a Playwright integration spec that exercises the local Next.js OCR callback route against staging data. The test inserts a controlled `ocr_jobs` row using the staging service role, posts a synthetic N8N-style callback payload to `/api/webhooks/ocr/callback`, and verifies database side effects through Supabase.

## Scope

- No schema changes.
- No production mutation.
- No real N8N call.
- No real customer PII.

## Flow

1. Load staging-only environment from Playwright/dotenv.
2. Refuse to run unless `NEXT_PUBLIC_SUPABASE_URL` contains `dnzytocmtmnptndeczny`.
3. Resolve the E2E commercial profile by `E2E_AGENT_EMAIL`.
4. Insert a synthetic `ocr_jobs` row with status `processing`, `agent_id`, `franchise_id`, and `client_segment = PYME`.
5. POST a completed callback payload with synthetic OCR data and `x-api-key`.
6. Assert the callback returns success and a client id.
7. Read `ocr_jobs` and `clients` using service role.
8. Verify status, client link, extracted data, ownership, segment, and type.
9. Clean synthetic rows in `finally`.

## Security

The test uses only synthetic values. It does not log secret values and does not assert against plaintext PII columns. Cleanup removes training examples, the OCR job, and the created client.
