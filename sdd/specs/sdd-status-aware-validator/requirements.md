# Requirements: SDD Status-Aware Validator

## Context

The current SDD validator enforces `requirements.md`, `design.md`, and `tasks.md` for any SDD feature whose status is not `pending`. That conflicts with the approved workflow because a feature in `requirements_ready` should not need `design.md` or `tasks.md` yet.

The goal is to make the validator enforce the correct artifacts for each SDD gate, so the process stays strict without requiring placeholder files.

## Requirements

### REQ-001: Status-Specific Artifact Enforcement

The SDD validator shall require only the artifacts appropriate for the feature's current status.

Verification: add or update validator checks and run `node sdd/scripts/validate-sdd.mjs`.

### REQ-002: Requirements Gate Behavior

WHEN a feature is `requirements_draft` or `requirements_ready`, the validator shall require `requirements.md` and shall not require `design.md` or `tasks.md`.

Verification: use validator logic review and, if practical, a lightweight fixture/test.

### REQ-003: Design Gate Behavior

WHEN a feature is `design_draft` or `design_ready`, the validator shall require both `requirements.md` and `design.md`, and shall not require `tasks.md`.

Verification: use validator logic review and, if practical, a lightweight fixture/test.

### REQ-004: Task And Build Gate Behavior

WHEN a feature is `tasks_ready`, `in_progress`, `verification`, or `done`, the validator shall require `requirements.md`, `design.md`, and `tasks.md`.

Verification: use validator logic review and `node sdd/scripts/validate-sdd.mjs` against the real repo.

### REQ-005: Active Feature Invariant

The validator shall continue enforcing that no more than one feature is `in_progress`.

Verification: preserve existing active feature check.

### REQ-006: No Product Behavior Changes

The implementation shall not modify application runtime code, schema, CI thresholds, Supabase config, generated types, or product UX.

Verification: PR diff review.

## Properties / Invariants

- The real repo must validate successfully after the change.
- The validator must remain runnable with plain Node: `node sdd/scripts/validate-sdd.mjs`.
- Error messages should remain clear enough to tell which feature and artifact failed.

## Open Questions

- None.
