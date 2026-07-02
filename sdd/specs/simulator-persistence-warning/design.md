# Simulator Persistence Warning Design

Status: design approved on 2026-07-02.

## Summary

Add a dedicated `persistenceWarning` state to the simulator hook. When proposal persistence fails after comparison succeeds, keep results on screen and render a compact warning banner in `SimulatorResults`.

## Affected Files

- `src/features/simulator/hooks/useSimulator.ts`
- `src/features/simulator/components/SimulatorView.tsx`
- `src/features/simulator/components/SimulatorResults.tsx`
- `src/features/simulator/components/PersistenceWarningBanner.tsx`
- `src/features/simulator/components/__tests__/PersistenceWarningBanner.test.tsx`

## Behavior

- `START_ANALYSIS` clears `persistenceWarning` alongside previous upload errors.
- The persistence `catch` in `runComparison` still logs sanitized technical context to the browser console, then sets a fixed user-facing warning.
- `SimulatorResults` receives `persistenceWarning` and delegates display to `PersistenceWarningBanner` as a `role="status"` banner above the result content.

## Privacy

The UI message is static and does not interpolate Supabase errors, invoice data, CUPS, DNI/CIF, public tokens, signed URLs, or raw payload details.

## Verification

- Component test renders the isolated warning banner and asserts that CUPS/DNI sample values are not present in the banner.
- Run SDD validation and focused simulator component test before wider gates.
