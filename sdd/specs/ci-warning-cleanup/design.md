# Design: CI Warning Cleanup

## Overview

This feature removes the six known lint warnings currently emitted by CI while preserving runtime behavior. It is documentation/process-safe and code-light: no schema, API, auth, role, PII, pricing, commission, OCR, or public proposal semantics change.

## Scope

Affected files:

- `src/features/crm/components/OcrJobsPanel.tsx`
- `src/features/simulator/components/Results/AnnualAuditView.tsx`
- `src/features/simulator/components/SimulatorHeroValue.tsx`
- `src/lib/aletheia/annualAudit.ts`
- `src/lib/aletheia/annualConsolidation.ts`

Out of scope:

- Supabase migrations or generated types.
- UI redesign.
- Business logic changes.
- Test coverage threshold changes.
- Any unrelated lint cleanup.

## Planned Changes

### OcrJobsPanel hook dependency

Warning: `React Hook useEffect has a missing dependency: 'router'.`

Plan:

- Add `router` to the realtime subscription `useEffect` dependency array.
- Keep `fetchJobs` in the dependency array.
- Do not alter channel filters, toast behavior, session storage payload, or navigation path.

Rationale:

`useRouter()` returns a stable navigation object in Next client components. Including it satisfies exhaustive-deps without changing the subscription lifecycle in ordinary use.

### AnnualAuditView unused profile parameter

Warning: `profile is defined but never used`.

Plan:

- Remove the unused `profile` parameter from `buildExecutiveSummary`.
- Update the single call site from `buildExecutiveSummary(audit, profile)` to `buildExecutiveSummary(audit)`.

Rationale:

The summary currently only uses audit findings and totals. Removing the parameter preserves output exactly.

### SimulatorHeroValue unused imports/local

Warnings: unused `AnimatePresence`, unused `confirmBtn`.

Plan:

- Remove `AnimatePresence` from the `framer-motion` import.
- Remove the unused `confirmBtn` local JSX value if it is not rendered.

Rationale:

Neither symbol contributes to rendered output today. Removing them preserves behavior.

### annualAudit unused reactive price constant

Warning: `REACTIVE_PRICE_EUR_KVARH` is assigned a value but never used.

Plan:

- Remove the unused constant.

Rationale:

Reactive cost values are already read from the annual profile. The constant is dead code.

### annualConsolidation unused boolean helper

Warning: `nb` is assigned a value but never used.

Plan:

- Remove the unused `nb` helper.

Rationale:

The surrounding block uses `n` and `nn`; `nb` is dead code.

## Verification Plan

- `npm run lint`
- `npx tsc --noEmit`
- `npm run test`
- `node sdd/scripts/validate-sdd.mjs`

`npm run build` is optional for this feature because no runtime behavior, schema, or critical flow changes are intended. If run, record the result in `progress/history.md`.

## Risks

- Adding `router` to the realtime `useEffect` dependency could theoretically resubscribe if the router object identity changed. This risk is low; if local review suggests instability, use a stable callback wrapper instead.
- Removing dead code could hide intentionally reserved constants. No current references exist, so this is acceptable.

## Rollback

Revert the PR. There is no data migration and no external state change.

## Approval

- [ ] Design approved.
