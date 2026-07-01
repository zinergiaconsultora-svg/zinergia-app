# Requirements — ZIN-SDD-027 Security Scan Advisory Warning

## Intent

Make the advisory `npm audit` step in CI report findings as an explicit warning instead of a misleading failed-step annotation, while preserving security visibility and downstream deploy behavior.

## EARS Requirements

- [REQ-001] WHEN `npm audit --audit-level=high` finds advisories, the security job shall keep the audit output visible in the workflow logs.
- [REQ-002] WHEN `npm audit --audit-level=high` exits non-zero, the workflow shall emit a GitHub Actions warning annotation explaining that the audit is advisory.
- [REQ-003] WHEN `npm audit --audit-level=high` exits non-zero, the step shall not produce a failed-step annotation that makes the successful security job look broken.
- [REQ-004] The security job shall continue running Trivy and uploading SARIF independently of npm audit findings.
- [REQ-005] The workflow shall preserve existing deployment gating, secrets, permissions, and Vercel deploy commands.

## Properties

- No application source behavior changes.
- No database schema change.
- No secrets are added, renamed, logged, or exposed.
