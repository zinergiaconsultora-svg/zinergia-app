# Design - Mutating Public Proposal E2E

Feature: `mutating-public-proposal-e2e`

Status: `approved`

## Approach

Extend the existing guarded staging fixture with append-only test data instead of introducing production data or mutating historical ledger rows.

1. Update `scripts/ensure-e2e-public-proposal.mjs` so every run inserts a fresh read-only proposal and a fresh mutable proposal with random public tokens.
2. Return the new mutable token directly to Playwright in JSON mode. `--write-env` remains available for read-only/manual runs without printing token values.
3. Add a Playwright spec that:
   - requires `E2E_RUN_MUTATING_PUBLIC_PROPOSAL=1`;
   - requires staging URL ref `dnzytocmtmnptndeczny`;
   - creates and uses an isolated mutable token for that run;
   - signs the public proposal through the UI;
   - queries Supabase via service role after acceptance to verify side effects.
4. Keep the existing read-only public proposal tests unchanged.

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
- No commission, commission event, task or contract from a previous run is deleted.

## Verification

- Seed script run against staging.
- Mutating E2E focused run.
- SDD validator, lint, type check and relevant tests.
