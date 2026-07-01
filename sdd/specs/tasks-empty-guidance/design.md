# Design — Tasks Empty Guidance

## Scope

This is a presentation-only improvement for `src/app/dashboard/tasks/page.tsx`.

## Approach

Create a small pure helper next to the page:

- `src/app/dashboard/tasks/emptyState.ts`
- Input: current task status filter.
- Output: title, description, action label, and action kind.

The page will use the helper only when `tasks.length === 0`. Existing loading, error, KPI, filters, create modal, delete, and toggle-complete flows remain unchanged.

## Copy Model

- `all`: explain that task management starts from manual follow-ups or automatic tasks created by accepted proposals.
- `pending`: explain that there are no pending follow-ups and the day is clear.
- `in_progress`: explain that no tasks are currently being worked.
- `completed`: explain that no tasks have been completed yet.

## Testing

Add focused Vitest coverage for the helper:

- first empty state with `all`
- operational status empty states
- stable CTA to create a task

## Security And Data

No PII, RLS, Supabase, API, schema, or mutation behavior changes.
