# Design - End-to-End Flow Integrity

Feature: `end-to-end-flow-integrity`

Status: `approved`

## Approach

Keep this change narrow and behavior-preserving except where the audited flow is currently broken.

1. Replace stale `/dashboard/comparator` navigation with `/dashboard/simulator`.
2. Extend the existing `pendingInvoiceData` handoff payload with optional metadata:
   - `ocrJobId`
   - `agentId`
   - `franchiseId`
3. Update the simulator preload effect to hydrate `ocrJobId` from that metadata.
4. Route proposal persistence through a server action that can validate and apply ownership overrides for admin-driven OCR conversions.
5. Extract acceptance side effects from `updateProposalStatusAction` into a shared server helper and reuse it from public acceptance after the atomic status update.
6. Add focused unit tests for handoff metadata and public acceptance side effects.

## Data Flow

Completed OCR job -> session handoff -> simulator state -> proposal persistence -> `proposals.ocr_job_id` and `ocr_jobs.compared_at`.

Public link accept -> atomic status update -> shared acceptance finalizer -> commission, lead closure, tasks, contract, notifications.

## Security

- The handoff metadata remains in `sessionStorage`, not query strings.
- Server-side writes validate the current role before honoring any ownership override.
- Public acceptance keeps rate limiting and signature validation before service-role work.
- Shared finalization must be idempotent around existing commission and contract/task guards.

## Test Strategy

- Unit test proposal service handoff behavior around `ocr_job_id`.
- Unit test public acceptance invokes the shared finalization path.
- Run `node sdd/scripts/validate-sdd.mjs`, `npm run lint`, and focused tests.
