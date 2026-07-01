# Requirements — ZIN-SDD-026 GitHub Actions Node 24 Actions

## Intent

Remove GitHub Actions Node 20 runtime deprecation warnings by upgrading first-party workflow actions while preserving the app's existing CI runtime and deployment behavior.

## EARS Requirements

- [REQ-001] WHEN the CI/CD workflow runs, the system shall use first-party GitHub Actions versions that run on the current Node 24 action runtime.
- [REQ-002] The CI/CD workflow shall preserve the existing application command runtime configured by `NODE_VERSION`.
- [REQ-003] The CI/CD workflow shall preserve npm dependency caching for all jobs that set up Node.js.
- [REQ-004] The CI/CD workflow shall preserve production and preview Vercel deploy commands, including `--archive=tgz`.
- [REQ-005] The change shall not alter application source, database schema, Supabase configuration, secrets, or deployment environment selection.

## Properties

- No database schema change is required.
- No secrets are added, renamed, logged, or exposed.
- CI job order and branch/event conditions remain unchanged.
