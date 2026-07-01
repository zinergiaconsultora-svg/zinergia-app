# Design — ZIN-SDD-029 Proposals Empty Guidance

## Scope

This feature is limited to the `/dashboard/proposals` empty state and focused unit coverage.

## Approach

- Add a pure helper under `src/app/dashboard/proposals/emptyState.ts`.
- The helper accepts:
  - `statusFilter`,
  - whether text search is active,
  - whether advanced filters are active.
- It returns:
  - title,
  - description,
  - action label,
  - action kind (`clear-filters` or `open-simulator`).

## UI Behavior

- Keep the existing card layout and icon.
- Replace the generic title/description branches with helper output.
- Keep the existing "Limpiar filtros" button for filtered empty states.
- Keep the existing simulator link for truly empty proposal portfolios.

## Test Strategy

- Add unit tests for the helper.
- Cover:
  - no proposals/no filters,
  - search or advanced filters active,
  - sent/accepted/draft/rejected status-specific empty states.

## Risks

- Copy must not imply that no proposals exist globally when only a filter is empty.
- Avoid adding new navigation beyond the existing clear-filters and simulator actions.
