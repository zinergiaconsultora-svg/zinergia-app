# Requirements — Stale OCR PR Triage

## Intent

Resolve the obsolete OCR pull requests left open from the pre-SDD period without merging stale, oversized, or unsafe diffs into the current codebase.

## EARS Requirements

- [REQ-001] WHEN stale OCR pull requests remain open, the repository shall identify whether they are mergeable, obsolete, or need a clean SDD follow-up.
- [REQ-002] IF a stale pull request diff is too large or based on outdated project state, THEN the repository shall close it with a clear explanation instead of merging it.
- [REQ-003] IF a stale pull request contains a still-useful idea that is not present in `main`, THEN the repository shall record that idea as a new clean SDD feature.
- [REQ-004] WHEN stale pull requests are closed, the repository shall preserve traceability through SDD history.

## Properties

- [INV-001] The triage shall not modify application runtime behavior.
- [INV-002] The triage shall not merge old branches into `main`.
- [INV-003] Any future implementation must start from current `main` and follow the current SDD workflow.
