# Design — Stale OCR PR Triage

## Scope

This is repository hygiene and process cleanup. It does not change application code.

## Findings

Open stale pull requests:

- `#1` — `fix(ocr): harden OCR pipeline — broadcast, race, silent failures`
- `#2` — `fix(ocr): idempotent callback + realtime publication + hung-jobs cleanup`
- `#3` — `refactor(ocr): rate limiting, dedupe N8N dispatch, archive stale snapshot`
- `#4` — `feat(ocr): admin metrics page + unit tests for recent OCR changes`

GitHub cannot render their diffs through `gh pr diff` because each exceeds the 20,000-line API limit. The PR file lists include historical project-wide changes, generated logs, root SQL scripts, old workflow state, and broad application changes unrelated to their titles.

## Decision

Close `#1` through `#4` as obsolete and not mergeable. Do not cherry-pick blindly.

The only clearly still-useful missing idea discovered during triage is a current, clean admin OCR observability page and metrics helper. That should be tracked as a new SDD feature and implemented from current `main` if prioritized.

## Risk

Closing old PRs is reversible in GitHub and does not delete branches. The risk of merging them is higher than closing them because they carry stale, oversized diffs across security, workflows, dependencies, root artifacts, and application code.
