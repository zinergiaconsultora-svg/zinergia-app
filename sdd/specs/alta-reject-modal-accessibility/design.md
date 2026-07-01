# Design - Alta Reject Modal Accessibility

Feature: `alta-reject-modal-accessibility`

Status: `approved`

## Finding

The reject modal renders visual labels for the reason select and note textarea, but the labels are not associated with their controls. Tests and assistive technology cannot reliably address the fields by their visible names. The modal container also lacks dialog semantics.

## Approach

Make a minimal semantic fix in `ExpedienteAlta`:

1. Add stable ids to the reject reason select and note textarea.
2. Add `htmlFor` to the existing visible labels.
3. Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` to the modal container.
4. Keep the rejection action, payload, visual layout, and state behavior unchanged.
5. Update the component regression to use `getByLabelText(...)` for the fields and assert the dialog name.

## Verification

- Focused Vitest for `src/features/admin/components/__tests__/ExpedienteAlta.test.tsx`.
- SDD validator, typecheck, lint, full tests, coverage and build.
