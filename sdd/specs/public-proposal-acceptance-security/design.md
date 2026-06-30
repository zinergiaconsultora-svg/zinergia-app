# Public Proposal Acceptance Security Design

Status: design approved on 2026-06-30. Tasks are ready for review.

## Summary

Harden the public proposal page and acceptance server action without redesigning the product flow. The main implementation target is `src/app/actions/publicProposal.ts`, supported by focused tests for token validation, response shape, signature validation, rate limiting and idempotent acceptance behavior.

The current implementation already has useful foundations:

- URL-safe token schema.
- Public read action scoped by `public_token` and status.
- In-memory rate limiters for view and accept actions.
- PNG data URL signature validation with a byte cap.
- Centralized service-role client usage via `createServiceClient()`.
- Commission upsert guarded by `proposal_id` conflict.
- Best-effort public view tracking and notifications.

This design tightens the weak spots: stricter required acceptance payload, more generic public errors, atomic accepted-state update, explicit response shape, and tests.

## Risk Profile

- Data/schema: no by default.
- PII: yes.
- Auth/RLS: yes.
- Public surface: yes.
- Cron/service role: no cron, yes service role on the server action.
- External integration: no.
- Business-critical calculation: indirect, because acceptance creates commission side effects.
- Required gates: `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- Optional/manual gate: public proposal happy path in browser.

## Affected Files

- `src/app/actions/publicProposal.ts`: main hardening target.
- `src/app/actions/__tests__/publicProposal.test.ts`: new focused server-action tests.
- `src/app/p/[token]/page.tsx`: only if metadata leaks too much information for invalid or unavailable proposals.
- `src/app/p/[token]/PublicProposalClient.tsx`: only if client-side behavior needs to handle already-accepted/idempotent responses more clearly.
- `sdd/specs/public-proposal-acceptance-security/*`: spec, tasks and completion notes.

## Non-goals

- Do not redesign the public proposal UI.
- Do not change proposal PDF generation.
- Do not change tariff comparison.
- Do not redesign commission calculation.
- Do not introduce Redis/Upstash in this feature. The current limiter remains acceptable defense-in-depth unless product needs multi-region abuse guarantees.

## Proposed Changes

### 1. Public response shaping

Keep `getPublicProposalAction(token)` as the only public read path. Ensure the selected columns remain intentionally narrow and do not include:

- `agent_id`
- `franchise_id`
- `client_id`
- `public_token`
- internal pricing audit fields not needed by the public page
- raw CUPS/DNI or calculation fields containing sensitive invoice data

Current risk: `calculation_data` is selected and may contain invoice-derived fields. The design should remove it from the public projection unless the client page actually needs it. If UI types require `Proposal`, introduce a narrower `PublicProposal` server type instead of returning a full `Proposal` shape.

Traceability: `REQ-001`, `INV-002`.

### 2. Required acceptance payload

Server-side acceptance should require:

- valid token
- non-empty `signatureData`
- valid PNG data URL
- non-empty trimmed `signedName`
- `signedName` length between a small lower bound and 200 characters

The client already disables the submit button without signature/name, but the server must enforce the same rule.

Traceability: `REQ-003`, `REQ-007`.

### 3. Generic public errors

Normalize token/proposal lookup failures to generic messages that do not disclose whether a token exists, a proposal exists, or a client exists. Suggested categories:

- invalid/unavailable link: `No hemos podido abrir esta propuesta. Contacta con tu asesor.`
- expired link: `Este enlace ha expirado. Contacta con tu asesor.`
- validation failure: `Revisa la firma y el nombre antes de continuar.`
- rate limited: current message is acceptable.

Avoid raw database error messages on public reads and accepts.

Traceability: `REQ-002`, `INV-002`.

### 4. Atomic idempotent acceptance update

Make the accepted-state write conditional:

- `eq('id', proposal.id)`
- `eq('status', 'sent')`
- `is('public_accepted_at', null)` where supported by the Supabase query builder

Then read the update result. If no row was updated, reload the proposal by id or token and return a stable already-accepted response if it is now accepted. This reduces the race window between the pre-check and update.

Commission creation already uses `upsert(..., { onConflict: 'proposal_id', ignoreDuplicates: true })`, so side effects are mostly protected. The proposal state update should match that idempotent posture.

Traceability: `REQ-004`, `REQ-007`, `INV-003`.

### 5. Audit event

Continue using `client_activities` for acceptance events if it is the canonical proposal timeline. The acceptance event should include only safe metadata:

- `proposal_id`
- `source: 'public_portal'`
- `accepted_at`

Avoid storing client IP, user-agent, raw signature payload or sensitive invoice data in activity metadata. The signed name may remain on `proposals.signed_name` if already part of the business record.

If tests or schema review show `client_activities` cannot reliably represent public acceptance, add a migration-backed audit table in a separate SDD subtask before implementation.

Traceability: `REQ-006`.

### 6. Tests

Add focused tests for `publicProposal.ts`. Mock Supabase clients, `headers()`, `revalidatePath()`, Sentry, logger and commission helpers as needed.

Required cases:

- invalid token returns `null`/generic failure without DB write.
- public read returns narrow public shape and excludes internal IDs.
- expired proposal returns unavailable/null.
- acceptance rejects missing signature and missing signer name.
- acceptance rejects oversized or non-PNG signature data.
- acceptance returns rate-limit failure after limiter threshold.
- acceptance of already accepted proposal returns success without duplicate update.
- acceptance successful path writes accepted state and safe activity metadata.
- invalid payload does not update proposal state.

Traceability: `REQ-001` through `REQ-007`.

## Data Model and Migrations

Migration required: no initially.

Types regeneration required: no initially.

Tables used:

- `proposals`
- `client_activities`
- `network_commissions`
- `franchise_config`
- `notifications`

Migration trigger:

- If there is no reliable place to audit public acceptance safely, create a dedicated audit table through `supabase/migrations/` and regenerate `src/types/database.types.ts`.

## Security and Privacy

- Public user remains unauthenticated and token-scoped.
- Service role remains server-only through `createServiceClient()`.
- Do not expose service-role data to the client.
- Do not return raw DB errors from public actions.
- Do not log signature payloads, tokens, CUPS, DNI or full invoice calculation data.
- Keep rate limiting before expensive/state-changing work.
- Keep acceptance idempotent.

## Test Plan

Unit:

- `src/app/actions/__tests__/publicProposal.test.ts`

Integration/manual:

- Open `/p/<token>` for a valid sent proposal.
- Accept with name and signature.
- Refresh accepted link and verify done state.
- Submit twice quickly and verify stable already-accepted behavior.
- Try invalid/expired token and verify generic unavailable state.

Quality gates:

```powershell
npx tsc --noEmit
npm run lint
npm run test
```

Run `npm run build` if implementation touches page rendering or shared proposal types.

## Rollback Plan

- Server-action changes can be reverted without data migration.
- If a migration is introduced for audit, rollback requires a paired migration or preserving the table and disabling writes.
- Because acceptance is idempotent and commission upsert is conflict-protected, rollback risk is mainly around public validation being too strict.

## Open Questions

- Does `calculation_data` currently contain CUPS or invoice-derived PII in public proposal responses?
- Is `client_activities` the desired long-term audit store for public acceptance?
- Should accepted links remain viewable forever after acceptance, or should they show only a minimal signed confirmation?
