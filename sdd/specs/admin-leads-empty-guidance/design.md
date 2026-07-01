# Design — ZIN-SDD-028 Admin Leads Empty Guidance

## Scope

This feature is limited to admin leads empty-state guidance and focused unit coverage.

## Approach

- Add a small pure helper under `src/features/admin/leads/emptyState.ts`.
- The helper accepts `AdminLeadFilters` and returns:
  - title,
  - description,
  - optional action hint.
- Queue-specific messages take precedence over outcome messages.
- `AdminLeadsView` replaces the generic empty-state copy with the helper output.

## UI Behavior

- Keep the current empty-state visual structure and icon.
- Add a stronger title and one or two concise guidance lines.
- Do not add new buttons or navigation that could conflict with existing filters.

## Test Strategy

- Add a focused unit test for `buildAdminLeadsEmptyState`.
- Cover at least:
  - a queue-specific case,
  - open outcome,
  - won/lost/all outcomes.

## Risks

- Copy can drift from business language; keep it operational and neutral.
- Avoid implying there is no data globally when only one filter is empty.
