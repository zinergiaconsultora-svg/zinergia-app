# Commission Split Hardening Design

Status: design approved on 2026-06-30. Tasks are ready for review.

## Summary

Unify commission creation behind one server-side domain module so public proposal acceptance and authenticated dashboard acceptance use identical monetary semantics, idempotency behavior and diagnostics.

The database already has a unique constraint on `network_commissions.proposal_id` in `supabase/migrations/20260420000000_baseline.sql`, so no migration is needed for idempotency.

## Current State

Two code paths create commissions:

- `src/app/actions/publicProposal.ts`
  - Uses service role after public acceptance.
  - Loads proposal context with `profiles!proposals_agent_id_fkey`.
  - Uses `offer_snapshot.estimated_agent_commission` when positive.
  - Falls back to `calculateCommissionSplit(annual_savings, applyFranchiseOverride(...))`.
  - Upserts into `network_commissions` with `onConflict: 'proposal_id'`.

- `src/app/actions/proposals.ts`
  - Uses session Supabase client after authenticated `updateProposalStatusAction(..., 'accepted')`.
  - Gets current authenticated user/profile as seller.
  - Duplicates the fixed-commission and fallback split logic.
  - Also awards `user_points`.

Pure calculation already exists in `src/lib/commissions/calculator.ts`.

## Risk Profile

- Data/schema: no.
- PII: no direct PII, but proposal/client context must not leak in logs.
- Auth/RLS: yes.
- Public surface: indirect, through public acceptance.
- Cron/service role: service role only in public acceptance path.
- External integration: no.
- Business-critical calculation: yes.
- Required gates: `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`.

## Affected Files

- `src/lib/commissions/calculator.ts`
  - Add pure helper for resolving commission amounts from fixed tariff commission vs annual-savings fallback.
- `src/lib/commissions/__tests__/calculator.test.ts`
  - Add tests for fixed tariff commission, fallback, royalty handling, rounding and invalid input.
- `src/app/actions/proposals.ts`
  - Replace duplicated calculation block with shared helper.
  - Keep authenticated side effects such as user points.
- `src/app/actions/publicProposal.ts`
  - Replace duplicated calculation block with shared helper.
  - Keep service-role persistence and Sentry logging.
- `src/app/actions/__tests__/publicProposal.test.ts`
  - Adjust or extend assertions for shared calculation behavior.
- Optional new file: `src/lib/commissions/recordCommission.ts`
  - Use only if extracting DB persistence meaningfully reduces duplication without creating awkward generic Supabase types.

## Non-goals

- No wallet UI changes.
- No withdrawal or invoicing changes.
- No historical backfill.
- No schema migration unless implementation discovers the baseline constraint is absent in the target environment.
- No change to business interpretation of fixed tariff commission unless explicitly approved.

## Design Decisions

### 1. Extract Pure Resolution Logic

Add a pure function in `src/lib/commissions/calculator.ts`:

```ts
export interface ResolveCommissionInput {
    annualSavings: number | null | undefined;
    estimatedAgentCommission: number | null | undefined;
    baseRule: CommissionRuleInput;
    royaltyPercent: number | null | undefined;
}

export interface ResolvedCommission {
    agentCommission: number;
    franchiseCommission: number;
    points: number;
    source: 'tariff_fixed' | 'savings_rule';
}
```

Behavior:

- If `estimatedAgentCommission > 0`, return:
  - `agentCommission = round2(estimatedAgentCommission)`
  - `franchiseCommission = round2(estimatedAgentCommission * royaltyPercent / 100)`, defaulting royalty to `0`.
  - `points = Math.round(baseRule.points_per_win)`
  - `source = 'tariff_fixed'`
- Otherwise:
  - Apply `applyFranchiseOverride(baseRule, royaltyPercent)`.
  - Use `calculateCommissionSplit(annualSavings ?? 0, effectiveRule)`.
  - Return `agentCommission = split.agent_commission`.
  - Return `franchiseCommission = split.franchise_profit`.
  - Return `points = split.points`.
  - Return `source = 'savings_rule'`.
- Reject negative fixed commission or negative annual savings.
- Round all monetary outputs to cents.

This preserves current production semantics while making them testable and identical across call sites.

Traceability: `REQ-002`, `REQ-003`, `REQ-004`, `REQ-008`.

### 2. Keep Persistence Idempotent

Both paths should continue using:

```ts
upsert(payload, { onConflict: 'proposal_id', ignoreDuplicates: true })
```

The baseline unique constraint `network_commissions_proposal_id_key UNIQUE (proposal_id)` is the real concurrency guard. The application-level pre-check may remain as a cheap early exit, but correctness must not depend on it.

Traceability: `REQ-001`, `REQ-009`, `INV-001`.

### 3. Preserve Different Context Loading, Share Calculation

Do not force both paths into one broad persistence abstraction if Supabase typing becomes messy.

Public acceptance:

- Must use service role server-side.
- Uses proposal's `agent_id` and `franchise_id`, not a public user.
- Logs Sentry context without PII.

Authenticated acceptance:

- Uses current user/profile scope.
- Awards gamification points after successful commission upsert.

Both paths call the same pure resolver for amounts.

Traceability: `REQ-003`, `REQ-005`, `REQ-006`, `REQ-007`.

### 4. Improve Diagnostics Without PII

When commission creation is skipped or fails, logs may include:

- `proposalId`
- `agentId`
- `franchiseId`
- `stage`
- `reason`

Logs must not include:

- CUPS
- DNI
- public token
- signature data
- full client payload
- raw `calculation_data`

Traceability: `REQ-005`, `REQ-006`, `INV-002`.

### 5. Tests

Add pure tests:

- fixed tariff commission with no royalty.
- fixed tariff commission with 20% royalty.
- fixed tariff commission with 100% royalty.
- savings fallback with null royalty.
- savings fallback with royalty override.
- zero annual savings fallback.
- negative fixed commission rejected.
- negative annual savings rejected.

Adjust server-action tests:

- Public acceptance should still upsert `network_commissions` with `onConflict: 'proposal_id'`.
- Public acceptance should use fixed tariff commission if present.
- Public acceptance should not attempt commission creation when proposal context lacks agent/franchise.

Authenticated path:

- Add focused test if current `proposals.ts` action mocking is practical.
- If not, rely on pure resolver tests plus a narrow implementation review of the call site and document the gap.

## Data Model and Migrations

Migration required: no.

Reason:

- `network_commissions_proposal_id_key UNIQUE (proposal_id)` already exists in the baseline migration.
- `src/types/database.types.ts` marks `network_commissions.proposal_id` relationship as `isOneToOne: true`.

Types regeneration required: no.

## Security and Privacy

- `clearCommissionAction`, `payCommissionAction` and `getAllCommissionsAction` already call `requireServerRole(['admin', 'franchise'])`.
- Public acceptance remains unauthenticated but token-scoped and service-role work remains server-only.
- No sensitive proposal data should be added to commission logs or metadata.

## Rollback Plan

- Revert pure resolver addition and call-site changes.
- No database rollback is required.
- Existing unique constraint and old duplicated logic remain compatible with current data.

## Open Questions

- Fixed tariff commission currently behaves as agent gross commission, with franchise commission calculated on top. This preserves current behavior, but the business may later decide fixed tariff commission should represent total pot instead.
- Should authenticated dashboard acceptance use proposal `agent_id` instead of current user when admin/franchise accepts on behalf of an agent? Current code uses current user for commission `agent_id`; that may be a business bug. This design keeps behavior unless explicitly changed.
