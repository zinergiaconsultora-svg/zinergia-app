# Design - Mutating Public Proposal E2E

Feature: `mutating-public-proposal-e2e`

Status: `approved`

## Approach

Extend the existing guarded staging fixture instead of introducing new production data.

1. Update `scripts/ensure-e2e-public-proposal.mjs` so refreshing the mutable fixture deletes rows in `network_commissions`, `tasks`, and `contracts` for that proposal before resetting acceptance fields.
2. Add a Playwright spec that:
   - requires `E2E_RUN_MUTATING_PUBLIC_PROPOSAL=1`;
   - requires staging URL ref `dnzytocmtmnptndeczny`;
   - uses `E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN`;
   - signs the public proposal through the UI;
   - queries Supabase via service role after acceptance to verify side effects.
3. Keep the existing read-only public proposal tests unchanged.

## Data Checks

The post-acceptance verification reads by `public_token`, then counts related rows by `proposal_id`:

- `proposals`: status, signed fields and accepted timestamp.
- `network_commissions`: exactly one row.
- `tasks`: exactly one documentation task.
- `contracts`: exactly one row.

## Security

- The spec skips without explicit opt-in.
- It refuses any Supabase URL not containing the staging project ref.
- Service role is used only in Node-side Playwright code, never in browser context.
- No raw token, signature payload, CUPS or DNI is logged.

## Verification

- Seed script run against staging.
- Mutating E2E focused run.
- SDD validator, lint, type check and relevant tests.
