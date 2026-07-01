# Design — ZIN-SDD-026 GitHub Actions Node 24 Actions

## Scope

This feature is limited to `.github/workflows/ci-cd.yml` and SDD tracking files.

## Documentation Basis

- GitHub Actions documentation examples now use newer first-party checkout actions with current Node runtimes.
- `actions/checkout` v5+ moved the action runtime to Node 24.
- `actions/setup-node` v6 examples support the existing `node-version` and `cache: npm` inputs.
- Next.js 16 requires Node.js `>=20.9.0`, so preserving `NODE_VERSION: '20.x'` keeps the application command runtime inside the supported range.

## Workflow Changes

- Replace all `actions/checkout@v4` usages with `actions/checkout@v6`.
- Replace all `actions/setup-node@v4` usages with `actions/setup-node@v6`.
- Keep `NODE_VERSION: '20.x'`.
- Keep `cache: 'npm'` on setup-node steps.
- Keep deploy commands unchanged, especially `--archive=tgz`.

## Verification

- Validate SDD metadata.
- Confirm workflow references no longer include `actions/checkout@v4` or `actions/setup-node@v4`.
- Run local lint, type check, tests, coverage, and build.
- Confirm PR CI removes the Node 20 action-runtime warning and post-merge production deploy remains green.
