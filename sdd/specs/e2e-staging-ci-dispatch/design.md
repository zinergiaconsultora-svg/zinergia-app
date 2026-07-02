# ZIN-SDD-034 — Design

## Scope

Add `.github/workflows/e2e-staging.yml` as a manual `workflow_dispatch` workflow.

## Workflow

- Trigger: manual only.
- Input:
  - `run_mutating_public_proposal`: boolean, default `false`.
- Runtime:
  - Ubuntu GitHub-hosted runner.
  - Node 20, matching existing CI.
  - `npm ci`.
  - `npx playwright install --with-deps chromium`.
- Default command:
  - `npm run test:e2e`.
- Mutating command:
  - `npm run test:e2e:public-mutating`.

## Secrets

Required for normal run:

- `STAGING_NEXT_PUBLIC_SUPABASE_URL`
- `STAGING_NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STAGING_APP_ENCRYPTION_KEY`
- `STAGING_APP_ENCRYPTION_PEPPER`
- `E2E_AGENT_EMAIL`
- `E2E_AGENT_PASSWORD`
- `E2E_ADMIN_EMAIL`
- `E2E_ADMIN_PASSWORD`
- `E2E_PUBLIC_PROPOSAL_TOKEN`

Required only for mutating run:

- `E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN`

## Safety

- `PLAYWRIGHT_BASE_URL` remains `http://127.0.0.1:3000`.
- The workflow starts `npm run dev:staging` via Playwright `webServer` only when `CI` is not `true`; because CI disables `webServer`, the workflow starts the server explicitly.
- The workflow writes a temporary `.env.staging.local` from secrets and validates it points at staging project ref `dnzytocmtmnptndeczny`.
- Mutating spec receives `E2E_RUN_MUTATING_PUBLIC_PROPOSAL=1` only when the workflow input is true.

## Verification

- Validate SDD.
- Lint YAML structurally by reviewing workflow syntax and running local quality gates.
- Run `npx tsc --noEmit`, `npm run lint`, `npm run test`.
- Do not run remote E2E locally unless staging secrets are present.
