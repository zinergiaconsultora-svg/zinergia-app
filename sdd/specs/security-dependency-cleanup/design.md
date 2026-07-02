# Security Dependency Cleanup Design

Status: design approved on 2026-07-02.

## Summary

Replace the vulnerable direct `xlsx` dependency with `@e965/xlsx@0.20.3`, a compatible maintained SheetJS package that includes fixes for the advisories affecting npm `xlsx@0.18.5`. Apply patch updates for Next.js and ESLint tooling to reduce transitive advisories.

## Affected Files

- `package.json`
- `package-lock.json`
- `src/features/tariffs/components/TariffExcelImportModal.tsx`
- `src/features/crm/components/BulkActions.tsx`
- `src/features/admin/components/charts/ExportButton.tsx`
- `src/services/simulatorService.ts`

## Behavior

- Static and dynamic imports move from `xlsx` to `@e965/xlsx`.
- Existing APIs remain the same: `read`, `utils.sheet_to_json`, `utils.json_to_sheet`, `utils.aoa_to_sheet`, `utils.book_new`, `utils.book_append_sheet`, and `writeFile`.
- CI security scan remains advisory for npm audit and still runs Trivy.

## Verification

- `npm audit --audit-level=high`
- `npm ls xlsx @e965/xlsx next eslint eslint-config-next`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run test:coverage`
- `npm run build`
