# Design — ZIN-SDD-027 Security Scan Advisory Warning

## Scope

This feature is limited to `.github/workflows/ci-cd.yml` and SDD tracking files.

## Documentation Basis

GitHub Actions workflow commands support `::warning` annotations. Exit codes determine whether a step is displayed as passed or failed; `continue-on-error` lets a workflow continue but can still leave a confusing failed-step annotation in the UI.

## Workflow Change

- Replace the bare advisory `npm audit --audit-level=high` command plus `continue-on-error: true` with a small shell block.
- The block:
  - runs `npm audit --audit-level=high`,
  - captures its exit code,
  - emits a `::warning` annotation when the exit code is non-zero,
  - exits successfully so the step status matches the job's advisory intent.
- Leave Trivy and SARIF upload behavior unchanged.
- Leave deploy jobs and `--archive=tgz` unchanged.

## Verification

- Validate SDD metadata.
- Confirm workflow still contains `npm audit --audit-level=high`, `::warning`, Trivy, SARIF upload, and Vercel deploy commands.
- Run local type check, lint, tests, coverage, and build.
- Confirm PR and post-merge CI pass and no longer show the failed-step annotation for npm audit.
