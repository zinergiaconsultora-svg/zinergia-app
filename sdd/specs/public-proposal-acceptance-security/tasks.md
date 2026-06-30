# Public Proposal Acceptance Security Tasks

Status: done on 2026-06-30.

## Tasks

- [x] T1. Create focused tests for public proposal read and validation behavior.
  - Add `src/app/actions/__tests__/publicProposal.test.ts`.
  - Mock Supabase server/service clients, `next/headers`, `next/cache`, Sentry, logger and commission helpers.
  - Cover invalid token, expired proposal, narrow public response shape, missing signature, missing signer name and invalid signature payload.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`, `REQ-007`, `INV-002`.
  - Verification: `npm run test -- publicProposal`.

- [x] T2. Narrow the public proposal read model.
  - In `src/app/actions/publicProposal.ts`, stop selecting public fields that are not required by `PublicProposalClient`.
  - Remove `calculation_data` from the public projection unless a real UI dependency is found.
  - Introduce or adjust a narrow public proposal return type instead of exposing the broader `Proposal` type where practical.
  - Traceability: `REQ-001`, `INV-002`.
  - Verification: public read tests assert internal IDs and sensitive calculation fields are absent.

- [x] T3. Enforce required acceptance payload on the server.
  - Require non-empty trimmed `signedName`.
  - Require present `signatureData`.
  - Keep PNG data URL validation and byte cap.
  - Normalize validation failures to a generic safe public message.
  - Traceability: `REQ-003`, `REQ-007`.
  - Verification: tests for missing/invalid signature and signer name.

- [x] T4. Normalize public error messages.
  - Avoid revealing whether a token, proposal, client, CUPS or DNI exists.
  - Return generic unavailable/expired/validation messages from public acceptance.
  - Keep raw database errors out of public return values.
  - Traceability: `REQ-002`, `INV-002`.
  - Verification: negative tests assert generic messages.

- [x] T5. Make proposal acceptance update atomic and idempotent.
  - Make the state-changing update conditional on `status = 'sent'` and `public_accepted_at IS NULL`.
  - If no row updates, reload state and return the stable already-accepted success when appropriate.
  - Preserve commission upsert idempotency.
  - Traceability: `REQ-004`, `REQ-007`, `INV-003`.
  - Verification: tests cover already accepted and double-submit style behavior.

- [x] T6. Keep acceptance audit metadata safe.
  - Ensure `client_activities` metadata stores only safe acceptance context such as `proposal_id`, `source` and `accepted_at`.
  - Do not store raw signature payload, IP, user-agent, token, CUPS or DNI in activity metadata.
  - If `client_activities` is insufficient during implementation, stop and add a migration task before code continues.
  - Traceability: `REQ-006`, `INV-002`, `INV-004`.
  - Verification: success-path test asserts safe metadata.

- [x] T7. Run verification gates and update SDD state.
  - Run `node sdd/scripts/validate-sdd.mjs`.
  - Run `npx tsc --noEmit`.
  - Run `npm run lint`.
  - Run `npm run test`.
  - Run `npm run build` if shared proposal types or public page rendering are changed.
  - Update `sdd/feature_list.json`, `sdd/progress/current.md` and `sdd/progress/history.md`.
  - Traceability: all requirements.
  - Verification: command outputs recorded in completion notes.

## Implementation Order

1. T1 test scaffolding and failing tests.
2. T2 public read narrowing.
3. T3 payload enforcement.
4. T4 public error normalization.
5. T5 atomic/idempotent update.
6. T6 audit metadata safety.
7. T7 verification and SDD closure.

## Completion Notes

- Implemented in `src/app/actions/publicProposal.ts`.
- Public UI now consumes the exported `PublicProposal` type in `src/app/p/[token]/PublicProposalClient.tsx`.
- Tests added in `src/app/actions/__tests__/publicProposal.test.ts`.
- No database migration was required.
- All required gates passed.
