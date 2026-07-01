# Tasks - Accepted Follow-up Idempotency Guard

Feature: `accepted-followup-idempotency-guard`

Status: `done`

- [x] 1. Define SDD requirements and design.
  - Traceability: all requirements.

- [x] 2. Add regression coverage for accepted documentation task retry.
  - Traceability: `REQ-001`, `REQ-002`.

- [x] 3. Add idempotency guard before inserting accepted documentation tasks.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-004`.

- [x] 4. Run focused and full verification gates, then mark SDD done.
  - Traceability: all requirements.

## Verification

- `npx vitest run src/app/actions/__tests__/proposals.test.ts`
- `npx vitest run src/app/actions/__tests__/publicProposal.test.ts`
- `node sdd/scripts/validate-sdd.mjs`
- `npx tsc --noEmit`
- `npm run lint`
- `npm run test`
- `npm run build`
