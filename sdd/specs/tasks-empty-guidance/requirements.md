# Requirements — Tasks Empty Guidance

## Intent

Clarify the next operational step when the commercial tasks page has no rows for the selected status filter.

## EARS Requirements

- [REQ-001] WHEN the tasks page has no tasks and the `Todas` filter is selected, the page shall explain that there are no pending follow-ups yet and invite the user to create a manual task.
- [REQ-002] WHEN a status filter has no tasks, the page shall show status-specific guidance instead of a generic empty message.
- [REQ-003] WHEN the empty state is shown, the page shall preserve the existing primary action to create a new task.
- [REQ-004] IF the tasks service returns an error, THEN the page shall keep rendering the existing error state and retry behavior.

## Properties

- [INV-001] The change shall not modify task fetching, creation, deletion, or status update behavior.
- [INV-002] The change shall not introduce database schema, Supabase policy, or server action changes.
- [INV-003] Empty-state copy selection shall be covered by focused unit tests.
