# ZIN-SDD-034 — E2E staging CI dispatch

## Requirements

- [REQ-001] The repository shall provide a manually triggered GitHub Actions workflow for Playwright E2E against staging.
- [REQ-002] WHEN the workflow runs, it shall use staging Supabase URL, anon key, encryption keys, E2E credentials, and public proposal token from GitHub secrets.
- [REQ-003] IF required non-mutating E2E secrets are missing, THEN the workflow shall fail before starting the app or Playwright.
- [REQ-004] WHILE running by default, the workflow shall execute only the read-safe E2E suite and shall not enable the mutating public proposal acceptance spec.
- [REQ-005] WHERE mutating E2E is explicitly requested, the workflow shall require both an input opt-in and a dedicated mutating proposal token secret.
- [REQ-006] The workflow shall upload Playwright reports and test results when available, even on failure.

## Properties

- The workflow must target staging, not production.
- The workflow must be manual to avoid surprise staging mutations or noise on every PR.
- No application schema or runtime behavior changes are allowed.
