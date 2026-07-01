# Design — ZIN-SDD-025 Alta Reject Modal Focus

## Scope

This feature is limited to `ExpedienteAlta` rejection modal accessibility behavior and its focused component tests.

## Component Changes

- Keep the existing modal markup and visual styling.
- Add a `triggerRef` in `ExpedienteAlta` for the "Rechazar alta" button.
- Pass the trigger ref to `RejectModal`.
- In `RejectModal`, keep refs for:
  - the dialog container,
  - the initial reason select,
  - the opener element.
- On mount, focus the reason select without changing page scroll.
- On unmount, restore focus to the opener if it is still connected to the DOM.
- Handle `Escape` on the dialog wrapper by calling `onClose`.
- Trap `Tab` and `Shift+Tab` among enabled focusable elements inside the dialog.

## Test Strategy

- Extend the existing `ExpedienteAlta` component test.
- Assert initial focus lands on the reason field.
- Assert Tab wraps from the final submit button back to the reason field.
- Assert Shift+Tab wraps from the first field back to the final submit button.
- Assert Escape closes the dialog and does not submit rejection data.

## Risks

- Manual focus management can become fragile if the modal grows; keep the helper local and minimal.
- Existing mouse behavior must remain unchanged.
