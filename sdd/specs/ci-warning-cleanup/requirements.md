# Requirements: CI Warning Cleanup

## Context

Current CI passes, but lint emits recurring warnings. The goal is to remove those warnings with narrow, behavior-preserving edits so future pipelines are easier to read and real regressions stand out.

Known warnings:

- `src/features/crm/components/OcrJobsPanel.tsx`: missing `router` dependency in `useEffect`.
- `src/features/simulator/components/Results/AnnualAuditView.tsx`: unused `profile`.
- `src/features/simulator/components/SimulatorHeroValue.tsx`: unused `AnimatePresence`.
- `src/features/simulator/components/SimulatorHeroValue.tsx`: unused `confirmBtn`.
- `src/lib/aletheia/annualAudit.ts`: unused `REACTIVE_PRICE_EUR_KVARH`.
- `src/lib/aletheia/annualConsolidation.ts`: unused `nb`.

## Requirements

### REQ-001: Zero Lint Warnings

The codebase shall run `npm run lint` with zero errors and zero warnings for the known warnings listed above.

Verification: `npm run lint`.

### REQ-002: Behavior Preservation

The cleanup shall not change user-visible behavior, calculation outputs, data access rules, or persisted data.

Verification: targeted code review plus existing tests for affected modules where available.

### REQ-003: Hook Dependency Correctness

WHEN fixing React hook dependency warnings, the implementation shall preserve the intended effect lifecycle and avoid introducing repeated fetches, stale closures, or navigation loops.

Verification: inspect affected `useEffect` dependencies and run lint.

### REQ-004: No Broad Refactor

The implementation shall only edit files directly responsible for the warnings unless a minimal adjacent test or type adjustment is necessary.

Verification: PR diff review.

## Properties / Invariants

- No Supabase schema, migration, RLS, policy, function, trigger, or generated type change is allowed.
- No auth, role, PII, OCR, pricing, commission, or public proposal behavior should change.
- The PR must remain a single-feature PR under `ci-warning-cleanup`.

## Open Questions

- None.
