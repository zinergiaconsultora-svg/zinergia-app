# Tasks - Alta Accepted State Guards

Feature: `alta-accepted-state-guards`

Status: `done`

- [x] 1. Define SDD requirements and design.
  - Traceability: all requirements.

- [x] 2. Add focused regression tests for non-accepted alta mutations.
  - Traceability: `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`.

- [x] 3. Add explicit accepted-status guards to alta mutations.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`.

- [x] 4. Run verification gates and mark SDD done.
  - Traceability: all requirements.

## Verification

- `npx vitest run src/app/actions/__tests__/alta.test.ts`
- `node sdd/scripts/validate-sdd.mjs`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run test`
- `npm run build`
