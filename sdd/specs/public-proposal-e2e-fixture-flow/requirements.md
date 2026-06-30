# Requirements: Public Proposal E2E Fixture Flow

## Scope

Make the valid public proposal E2E path repeatable and safe by using deterministic staging fixtures instead of manual tokens or production proposal data.

## Requirements

- [REQ-001] WHEN the public proposal E2E suite needs a valid token, the system shall use `E2E_PUBLIC_PROPOSAL_TOKEN` as the read-only fixture token.
- [REQ-002] IF an older environment still defines `E2E_PROPOSAL_TOKEN`, the tests shall accept it as a temporary fallback without making it the documented path.
- [REQ-003] WHEN seeding public proposal fixtures, the script shall refuse to run unless the Supabase URL points to the known staging project.
- [REQ-004] WHEN seeding public proposal fixtures, the operator shall explicitly opt in with `E2E_ALLOW_STAGING_SEED=1`.
- [REQ-005] WHEN `--write-env` is passed, the seed script shall update only fixture token variables in `.env.staging.local`.
- [REQ-006] WHEN the valid public proposal smoke opens the signature step, it shall stop before confirming acceptance.
- [REQ-007] The mutable acceptance fixture shall use a separate variable, `E2E_MUTATING_PUBLIC_PROPOSAL_TOKEN`, and shall not run in ordinary smoke tests.
- [REQ-008] The process shall not require storing production proposal tokens or real customer proposal data in git.

## Invariants

- No database schema migration is required.
- No service-role key may be printed, committed, or exposed to browser code.
- Production smoke remains read-only; full fixture setup belongs to staging.
