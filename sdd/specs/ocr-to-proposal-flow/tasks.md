# OCR to Proposal Flow Tasks

Status: done on 2026-06-30.

## Tasks

- [x] T1. Add migration for proposal OCR provenance.
  - Add nullable `ocr_job_id` to `public.proposals`.
  - Add FK to `public.ocr_jobs(id)` with `ON DELETE SET NULL`.
  - Add partial index on `ocr_job_id`.
  - Add column comment.
  - Traceability: `REQ-001`, `REQ-002`, `INV-004`.

- [x] T2. Regenerate or update Supabase/database and CRM types.
  - Update `src/types/database.types.ts` with `proposals.ocr_job_id`.
  - Update `src/types/crm.ts` `Proposal`.
  - Traceability: `REQ-001`, `REQ-002`.

- [x] T3. Persist OCR provenance for best simulator proposal.
  - Update `proposalService.logSimulation(...)` to insert `ocr_job_id` for real UUID job ids.
  - Keep `ocr_jobs.update({ client_id, compared_at })`.
  - Traceability: `REQ-001`, `REQ-003`, `REQ-004`.

- [x] T4. Persist OCR provenance for secondary simulator proposals.
  - Update `useSimulator.runComparison` secondary `saveProposal(...)` calls to pass the same real `ocr_job_id`.
  - Do not persist mock job IDs.
  - Traceability: `REQ-002`, `REQ-005`.

- [x] T5. Add tests for proposal provenance persistence.
  - Cover `logSimulation` insert payload includes `ocr_job_id`.
  - Cover missing/mock job id results in `ocr_job_id: null` or omitted.
  - Keep public proposal tests green.
  - Traceability: `REQ-001`, `REQ-003`, `REQ-005`, `REQ-008`.

- [x] T6. Run verification gates and close SDD.
  - `node sdd/scripts/validate-sdd.mjs`
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run test`
  - `npm run build`
  - Update SDD history and task status.
  - Traceability: all requirements.

## Completion Notes

- Implemented in `supabase/migrations/20260630131500_proposal_ocr_job_provenance.sql`, `src/services/crm/proposals.ts`, `src/features/simulator/hooks/useSimulator.ts`, `src/types/crm.ts` and `src/types/database.types.ts`.
- Tests added in `src/services/crm/__tests__/proposals.test.ts`.
- Remote Supabase type generation was not run because `SUPABASE_ACCESS_TOKEN` is missing in this shell.
- All local gates passed.
