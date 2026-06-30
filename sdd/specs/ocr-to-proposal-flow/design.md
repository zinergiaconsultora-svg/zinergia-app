# OCR to Proposal Flow Design

Status: design approved on 2026-06-30. Tasks are ready for implementation.

## Summary

Add durable proposal-level provenance for simulator proposals by introducing a nullable `proposals.ocr_job_id` foreign key to `ocr_jobs`. Then propagate the OCR job id through the simulator persistence path for the best proposal and secondary candidates.

This is intentionally a small schema change because existing metadata is not enough: `ocr_jobs` knows its `client_id` and `compared_at`, while `proposals` has snapshots and `source_*` fields, but there is no direct way to answer "which OCR job produced this proposal?"

## Risk Profile

- Data/schema: yes.
- PII: yes, because OCR/proposal payloads contain invoice-derived data.
- Auth/RLS: yes.
- Public surface: indirect; public proposal reads must continue to exclude full `calculation_data`.
- Cron/service role: no.
- External integration: no N8N changes.
- Business-critical calculation: yes, but no change to ranking/calculation logic intended.
- Required gates: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`.

## Affected Files

- `supabase/migrations/<timestamp>_proposal_ocr_job_provenance.sql`
  - Add nullable `proposals.ocr_job_id`.
  - Add FK to `ocr_jobs(id)` with `ON DELETE SET NULL`.
  - Add index for lookup by OCR job.
  - Add column comment.
- `src/types/database.types.ts`
  - Regenerated after migration.
- `src/types/crm.ts`
  - Add optional `ocr_job_id?: string | null` to `Proposal`.
- `src/services/crm/proposals.ts`
  - Persist `ocr_job_id` in `logSimulation(...)`.
  - Allow `saveProposal(...)` to persist `ocr_job_id` for secondary candidates.
  - Keep existing `ocr_jobs.update({ client_id, compared_at })`.
- `src/features/simulator/hooks/useSimulator.ts`
  - Pass `ocr_job_id` when saving secondary proposals.
  - Improve persistence failure state so comparison success with failed save is not silent.
- Tests, likely in a new `src/services/crm/__tests__/proposals.test.ts` or a focused helper test.
- Existing public proposal tests must stay green.

## Non-goals

- No N8N webhook rewrite.
- No Aletheia ranking changes.
- No historical backfill.
- No public proposal acceptance changes.
- No storage/Drive lifecycle changes.

## Data Model

Migration:

```sql
ALTER TABLE public.proposals
    ADD COLUMN IF NOT EXISTS ocr_job_id uuid;

ALTER TABLE public.proposals
    ADD CONSTRAINT proposals_ocr_job_id_fkey
    FOREIGN KEY (ocr_job_id)
    REFERENCES public.ocr_jobs(id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_ocr_job_id
    ON public.proposals(ocr_job_id)
    WHERE ocr_job_id IS NOT NULL;

COMMENT ON COLUMN public.proposals.ocr_job_id IS
    'Originating OCR job that produced this simulator proposal, when available.';
```

Implementation detail: use a defensive `DO $$` block or `ALTER TABLE ... ADD CONSTRAINT` guarded by `pg_constraint` lookup, because `ADD CONSTRAINT IF NOT EXISTS` is not available for all supported Postgres versions.

Types:

- Regenerate with the repo-approved PowerShell-safe command:

```powershell
npx supabase gen types typescript --project-id gmjgkzaxmkaggsyczwcm | Set-Content -LiteralPath 'src\types\database.types.ts' -Encoding utf8
```

## Flow Changes

### Best proposal

`proposalService.logSimulation(invoiceData, bestResult, clientName, aletheiaResult, ocrJobId)` should insert:

```ts
ocr_job_id: ocrJobId ?? null
```

when `ocrJobId` is a real UUID. It should not persist mock IDs such as `MOCK-JOB`.

Traceability: `REQ-001`, `REQ-003`, `REQ-004`.

### Secondary proposals

In `useSimulator.runComparison`, secondary candidates currently call `crmService.saveProposal(...)` without OCR provenance. Pass:

```ts
ocr_job_id: state.ocrJobId
```

only when `state.ocrJobId` is a real UUID and not mock mode.

Traceability: `REQ-002`.

### OCR job linkage

Keep the current `ocr_jobs.update({ client_id, compared_at })` in `proposalService.logSimulation`. That remains the lead/invoice side of the link.

Traceability: `REQ-004`.

### Persistence failure visibility

Today `useSimulator.runComparison` catches persistence failures and logs to `console.error`, while the comparison remains visible. Replace or augment that with user-visible state:

- Keep comparison results visible.
- Set `uploadError` or a new persistence warning state with a non-PII message such as: "La comparativa se ha calculado, pero no se pudo guardar en CRM. Intenta guardar de nuevo."
- Avoid logging CUPS/DNI/raw invoice payload.

Minimal implementation can use existing `SET_ERROR` if UI semantics are acceptable. Prefer a distinct non-blocking warning only if the current UI would imply the comparison itself failed.

Traceability: `REQ-006`, `REQ-010`.

## Security and Privacy

- `ocr_job_id` is an internal UUID and must not be selected by `getPublicProposalAction`.
- Public proposal tests from `public-proposal-acceptance-security` must continue to assert no internal fields leak.
- Do not add CUPS/DNI/public token/file signed URL to activity metadata.
- Preserve ownership checks in `getOcrJobStatus`, `getOcrJobsByClient`, and `markOcrJobFailed`.
- Proposal persistence remains behind authenticated Supabase/RLS and server actions used by `resolveOrCreateClientAction`.

## Test Plan

Unit/integration style:

- Test that `proposalService.logSimulation(...)` inserts `ocr_job_id` for a real UUID.
- Test that `proposalService.logSimulation(...)` omits/nulls `ocr_job_id` for missing/mock job id.
- Test that secondary proposal payloads in `useSimulator.runComparison` include the same `ocr_job_id` when saved.
- Test that pricing defaults remain present: `offer_snapshot`, `source_tariff_id`, `price_snapshot`, `price_snapshot_at`, `pricing_status`, `proposal_version`.
- Existing `publicProposal` tests must stay green to prove public reads do not expose internal provenance or `calculation_data`.

Quality gates:

```powershell
node sdd/scripts/validate-sdd.mjs
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

Optional local DB verification if credentials/session are available:

```powershell
npx supabase db push
```

## Rollback Plan

- Code rollback is straightforward because `ocr_job_id` is nullable.
- DB rollback, if required before release, can drop index, FK, and column in a follow-up migration.
- Existing proposals without `ocr_job_id` remain valid.

## Open Questions

- Should persistence warning be a non-blocking banner separate from `uploadError`? This is better UX, but slightly broader UI work.
- Should secondary proposals all get `ocr_job_id`, or should only the best proposal be linked? This design links all candidates because they share the same comparison origin.
- Should there be an explicit activity event for "OCR comparison saved" beyond existing `simulation_completed`? This design keeps existing activity unless a product need appears.
