# Tasks - Alta Admin Revalidation Audit

Feature: `alta-admin-revalidation-audit`

Status: `done`

- [x] 1. Define SDD requirements and design.
  - Traceability: all requirements.

- [x] 2. Add regression coverage for admin/dashboard revalidation after successful alta transitions.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`.

- [x] 3. Replace repeated dashboard revalidation with shared alta revalidation helper.
  - Traceability: `REQ-001`, `REQ-002`.

- [x] 4. Run verification gates and mark SDD done.
  - Traceability: all requirements.

## Verification

- `npx vitest run src/app/actions/__tests__/alta.test.ts`
- `node sdd/scripts/validate-sdd.mjs`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run test`
- `npm run build`
