# Tasks - Vercel Archive Deploy

Feature: `vercel-archive-deploy`

Status: `done`

- [x] 1. Define SDD requirements and design.
  - Traceability: all requirements.

- [x] 2. Add `--archive=tgz` to prebuilt production and preview deploy commands.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-003`.

- [x] 3. Run validation and confirm CI deploy behavior.
  - Traceability: all requirements.

## Verification

- `rg -n "vercel deploy --prebuilt" .github/workflows/ci-cd.yml`
- `node sdd/scripts/validate-sdd.mjs`
- GitHub Actions PR/main deploy jobs.
