# Design: Public Proposal E2E Fixture Flow

## Summary

Replace the ambiguous `E2E_PROPOSAL_TOKEN` process with a deterministic staging fixture flow. The fixture script creates or refreshes fake client/proposal rows in staging and can write the resulting token names into the gitignored `.env.staging.local`.

## Fixture Script

`scripts/ensure-e2e-public-proposal.mjs`:

- Loads `.env.staging.local`.
- Requires `E2E_ALLOW_STAGING_SEED=1`.
- Verifies `NEXT_PUBLIC_SUPABASE_URL` includes staging ref `dnzytocmtmnptndeczny`.
- Uses the service role key only in Node.
- Finds the E2E agent profile by `E2E_AGENT_EMAIL`.
- Creates/reuses a fake client marked with `lead_source = e2e-public-proposal-fixture`.
- Creates/refreshes two deterministic public proposal rows:
  - `E2E_PUBLIC_PROPOSAL_TOKEN`: read/signature-step smoke fixture.
  - `E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN`: reserved mutable acceptance fixture.
- With `--write-env`, updates only those two token lines in `.env.staging.local`.

## Test Changes

- `proposal-public.spec.ts` uses `E2E_PUBLIC_PROPOSAL_TOKEN`, with `E2E_PROPOSAL_TOKEN` as fallback.
- The signature-flow smoke clicks "Aceptar y firmar" but asserts that "Confirmar firma" is disabled, so it does not accept a proposal.
- `simulator.spec.ts` and `a11y.spec.ts` read the new variable with fallback.

## Documentation

`e2e/README.md` documents:

- The seed command.
- The staging-only guard.
- The difference between read-only and mutable fixture tokens.
- Production smoke limitations.

## Verification

- `npm run test:e2e:seed-public-proposal -- --write-env` with `E2E_ALLOW_STAGING_SEED=1`.
- `npm run test:e2e -- e2e/proposal-public.spec.ts --project=chromium`.
- `node sdd/scripts/validate-sdd.mjs`.
- `npm run lint`.
- `npx tsc --noEmit`.
