# Design: SDD Status-Aware Validator

## Summary

Make `sdd/scripts/validate-sdd.mjs` enforce artifacts by lifecycle status instead of requiring every SDD artifact as soon as a feature leaves `pending`.

## Status Gate Matrix

| Status | Required artifacts |
| --- | --- |
| `pending` | none |
| `requirements_draft`, `requirements_ready`, `blocked` | `requirements.md` |
| `design_draft`, `design_ready` | `requirements.md`, `design.md` |
| `tasks_ready`, `in_progress`, `verification`, `done` | `requirements.md`, `design.md`, `tasks.md` |

`blocked` intentionally requires only requirements because a feature can be blocked before design is known; the blocking reason belongs in progress/history.

## Implementation

- Add a `requiredSpecFilesForStatus(status)` helper.
- Export a pure `validateSdd(root)` function that returns failures instead of exiting directly.
- Keep CLI behavior unchanged when the script is executed directly.
- Add Node built-in test coverage with temporary SDD fixture directories.

## Verification

- `node --test sdd/scripts/validate-sdd.test.mjs`
- `node sdd/scripts/validate-sdd.mjs`
- `npm run lint`

