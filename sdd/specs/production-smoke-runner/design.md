# Design: Production Smoke Runner

## Approach

Add a PowerShell runner under `scripts/` and expose it via `npm run test:e2e:prod-smoke`.

The runner sets `PLAYWRIGHT_BASE_URL` to production and `CI=1`, which prevents Playwright from starting the local `dev:staging` web server. It prompts for commercial/admin credentials only when those roles are not skipped.

## Safety

- Passwords are collected with `Read-Host -AsSecureString`.
- Credentials are passed only as process environment variables for the child Playwright process.
- Existing environment values are restored in a `finally` block.
- `-SkipAgent` and `-SkipAdmin` force empty E2E credential variables so `.env.staging.local` cannot leak into a production smoke run.

## Validation

The minimum safe production smoke is:

```powershell
npm run test:e2e:prod-smoke -- -SkipAgent -SkipAdmin
```

This runs only the unauthenticated login/redirect checks.
