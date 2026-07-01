# Tasks - Alta Reject Modal Accessibility

Feature: `alta-reject-modal-accessibility`

Status: `done`

- [x] 1. Define SDD requirements and design.
  - Traceability: all requirements.

- [x] 2. Add regression coverage for accessible reject modal fields.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`.

- [x] 3. Associate labels and dialog semantics in `ExpedienteAlta`.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`.

- [x] 4. Run verification gates and mark SDD done.
  - Traceability: all requirements.

## Verification

- `npx vitest run src/features/admin/components/__tests__/ExpedienteAlta.test.tsx`
- `node sdd/scripts/validate-sdd.mjs`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run test`
- `npm run test:coverage`
- `npm run build`
