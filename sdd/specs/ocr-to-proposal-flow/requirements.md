# OCR to Proposal Flow Requirements

Status: requirements approved on 2026-06-30. Design is ready for review.

## Intent

Cerrar la trazabilidad operativa desde una factura subida al simulador hasta las propuestas generadas, de forma que el equipo pueda reconstruir que OCR produjo que comparativa, que propuesta se guardo, que cliente quedo asociado y que errores ocurrieron si el flujo no pudo persistir datos.

## Current Observations

- `analyzeDocumentAction` / `analyzeDocumentByUrlAction` create `ocr_jobs` with `agent_id`, `franchise_id`, `file_name`, `file_path`, `client_segment`, `status` and `extracted_data`.
- `useSimulator` stores `ocrJobId`, keeps `originalInvoiceData`, allows OCR confirmation and calls `calculateAletheiaSavings`.
- `proposalService.logSimulation(...)` resolves or creates a client, saves the best proposal, then updates `ocr_jobs.client_id` and `compared_at`.
- Additional proposals are saved through `proposalService.saveProposal(...)` but are not directly linked to the OCR job.
- Proposal records already store price snapshots and `calculation_data`, including `calculation_audit`.
- Mock OCR results are intentionally not persisted from `useSimulator`.
- Some failures while saving proposals are caught and logged in the browser console, which may leave comparison results visible but not persisted.

## Scope

In scope:

- Traceability from `ocr_jobs` to client and generated proposal(s).
- Persisted proposal metadata needed to know which OCR/comparison produced it.
- Failure handling when comparison succeeds but proposal persistence fails.
- Consistent behavior for best proposal and additional proposal candidates.
- Tests for mapping, persistence contracts and no-mock persistence.
- PII-safe logging and error reporting.

Out of scope:

- Rewriting the OCR webhook or N8N workflow.
- Redesigning the simulator UI.
- Changing Aletheia ranking logic.
- Changing public proposal acceptance; that was handled in `public-proposal-acceptance-security`.
- Backfilling historical OCR/proposal links unless explicitly approved later.

## Requirements

[REQ-001] WHEN a real OCR job produces invoice data and comparison runs successfully, the system shall persist the best proposal with a durable reference to the originating OCR job.

Verification:

- Test or implementation review confirms saved proposal data includes an OCR provenance field or equivalent durable link.

[REQ-002] WHEN multiple proposal candidates are persisted from the same comparison, the system shall preserve their common OCR/comparison provenance consistently.

Verification:

- Test covers best proposal and secondary proposal persistence from one comparison.

[REQ-003] WHEN a proposal is persisted from simulator results, the system shall preserve tariff price snapshot fields needed for later repricing review.

Verification:

- Tests confirm `offer_snapshot`, `source_tariff_id`, `price_snapshot`, `price_snapshot_at`, `pricing_status` and `proposal_version` are present where applicable.

[REQ-004] WHEN a client is resolved or created from OCR invoice data, the system shall update the originating OCR job with the resolved `client_id` and `compared_at` timestamp.

Verification:

- Test covers `ocr_jobs.update({ client_id, compared_at })` for a real `ocrJobId`.

[REQ-005] IF the simulator is using mock OCR data, THEN the system shall not persist clients, proposals, OCR links, public links or commercial activities from that mock data.

Verification:

- Test or component-hook review confirms mock mode skips persistence.

[REQ-006] IF comparison succeeds but persistence of client/proposal/linking fails, THEN the system shall surface a non-PII recoverable error state instead of silently relying only on `console.error`.

Verification:

- Test or design confirms the user gets an actionable failure indication and logs exclude CUPS/DNI.

[REQ-007] WHEN OCR data is confirmed or edited before comparison, the system shall preserve the original OCR snapshot separately from edited invoice data for training/correction purposes.

Verification:

- Existing reducer behavior or tests confirm `originalInvoiceData` is immutable after user edits.

[REQ-008] WHEN persisted proposal `calculation_data` includes invoice-derived fields, the system shall not expose that full payload through public proposal reads.

Verification:

- Covered by previous public proposal tests; this feature must not regress it.

[REQ-009] WHEN an OCR job or proposal link operation is performed, the system shall enforce user ownership or role scope before reading or writing.

Verification:

- Review/tests confirm server actions use `requireServerRole`, authenticated user scope, or RLS-safe filters.

[REQ-010] WHEN OCR/comparison/proposal events are logged, logs and activity metadata shall not include CUPS, DNI, public tokens, raw signed URLs or full invoice payloads.

Verification:

- Review changed logging and metadata fields.

## Properties / Invariants

- [INV-001] Mock OCR data shall never create durable CRM records.
- [INV-002] A persisted simulator proposal shall have enough provenance to reconstruct its calculation source.
- [INV-003] Public proposal reads shall never expose full `calculation_data`.
- [INV-004] Schema changes, if needed for provenance, shall go through `supabase/migrations/` and regenerated Supabase types.
- [INV-005] OCR job ownership checks shall be preserved for agent-scoped reads and updates.

## Open Questions

- Should provenance live as a new nullable `proposals.ocr_job_id` column, or inside existing `calculation_data`/`price_snapshot` metadata?
- Should secondary proposal candidates link directly to the same `ocr_job_id`, or only the best proposal?
- Should proposal persistence failures block showing comparison results, or show results with a clear "not saved" state and retry action?
- Do we want a dedicated activity type for `ocr_to_proposal_saved`, or is `simulation_completed` enough?
