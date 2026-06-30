# Commission Split Hardening Tasks

Status: done on 2026-06-30.

## Tasks

- [x] T1. Add pure resolver tests for commission amount semantics.
  - Extend `src/lib/commissions/__tests__/calculator.test.ts`.
  - Cover fixed tariff commission with null, 20% and 100% royalty.
  - Cover savings-rule fallback with null and positive royalty.
  - Cover zero annual savings.
  - Cover negative fixed commission and negative annual savings rejection.
  - Traceability: `REQ-002`, `REQ-003`, `REQ-004`, `REQ-008`.
  - Verification: `npm run test -- calculator`.

- [x] T2. Implement shared pure commission resolver.
  - Add `resolveCommissionAmounts(...)` to `src/lib/commissions/calculator.ts`.
  - Return agent amount, franchise amount, points and source.
  - Preserve current fixed-tariff and savings-fallback semantics.
  - Keep all monetary values rounded to cents.
  - Traceability: `REQ-002`, `REQ-003`, `REQ-004`, `REQ-008`.
  - Verification: resolver unit tests pass.

- [x] T3. Replace duplicated public acceptance calculation.
  - Update `src/app/actions/publicProposal.ts` to call the shared resolver.
  - Preserve service-role-only persistence.
  - Preserve `upsert(..., { onConflict: 'proposal_id', ignoreDuplicates: true })`.
  - Keep logs/Sentry context non-PII.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-005`, `REQ-009`.
  - Verification: `npm run test -- publicProposal`.

- [x] T4. Replace duplicated authenticated proposal calculation.
  - Update `src/app/actions/proposals.ts` to call the shared resolver.
  - Preserve existing authorization and proposal scoping.
  - Preserve gamification points behavior.
  - Preserve `upsert(..., { onConflict: 'proposal_id', ignoreDuplicates: true })`.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-004`, `REQ-007`, `REQ-009`.
  - Verification: focused test if practical; otherwise covered by pure resolver tests plus TypeScript/build.

- [x] T5. Improve non-PII skip/failure diagnostics.
  - Log/report safe reasons for skipped commission creation, such as missing agent, franchise or commission base.
  - Do not log CUPS, DNI, public token, signature data, full client payload or raw `calculation_data`.
  - Traceability: `REQ-005`, `REQ-006`, `INV-002`.
  - Verification: review changed logs and tests where practical.

- [x] T6. Run gates and close SDD.
  - Run `node sdd/scripts/validate-sdd.mjs`.
  - Run `npm run test -- calculator`.
  - Run `npm run test -- publicProposal`.
  - Run `npx tsc --noEmit`.
  - Run `npm run lint`.
  - Run `npm run test`.
  - Run `npm run build`.
  - Update `sdd/feature_list.json`, `sdd/progress/current.md`, `sdd/progress/history.md` and completion notes.
  - Traceability: all requirements.

## Implementation Order

1. T1 failing/coverage tests.
2. T2 pure resolver implementation.
3. T3 public acceptance refactor.
4. T4 authenticated proposal refactor.
5. T5 diagnostics cleanup.
6. T6 verification and SDD closure.

## Completion Notes

- Implemented in `src/lib/commissions/calculator.ts`, `src/app/actions/publicProposal.ts` and `src/app/actions/proposals.ts`.
- Tests extended in `src/lib/commissions/__tests__/calculator.test.ts`.
- Existing `src/app/actions/__tests__/publicProposal.test.ts` remains green after refactor.
- No Supabase migration was required.
- All required gates passed.
