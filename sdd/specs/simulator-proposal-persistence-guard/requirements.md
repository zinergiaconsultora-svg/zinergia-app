# Requirements: Simulator Proposal Persistence Guard

## Status

`approved`

## Requirements

- [REQ-001] WHEN the simulator persists the best comparison result, the proposal shall include the real `ocr_job_id`, client id, agent/franchise ownership, price snapshot, pricing status, and proposal version.
- [REQ-002] WHEN the simulator persists secondary comparison candidates, each proposal shall preserve the same real `ocr_job_id`.
- [REQ-003] WHEN a proposal has enough pricing inputs, persistence shall populate `offer_snapshot`, `source_tariff_id`, `price_snapshot`, `price_snapshot_at`, `pricing_status`, and `proposal_version`.
- [REQ-004] IF the OCR job id is not a real UUID, THEN persistence shall not link proposals or OCR jobs to that mock id.

## Properties

- The guard must be unit-level and not mutate staging or production.
- The guard must cover the simulator service boundary used by `useSimulator.runComparison`.
