# Design - Accepted Follow-up Idempotency Guard

Feature: `accepted-followup-idempotency-guard`

Status: `approved`

## Finding

`finalizeAcceptedProposalSideEffects(...)` is intentionally shared by public and authenticated acceptance. Commission creation is guarded by `network_commissions.proposal_id`, and contract creation checks for an existing contract. The accepted documentation task is inserted unconditionally by `generateFollowUpTasks(...)`.

If the finalizer is retried after a proposal is already accepted, the task can duplicate even though the rest of the business effects stay idempotent.

## Approach

Keep `generateFollowUpTasks(...)` as the single task helper, but add a narrow guard only for `status === 'accepted'`:

1. Query `tasks` for an existing task with the same `proposal_id`, type `documentation`, and `auto_generated = true`.
2. If found, return without inserting a duplicate accepted task.
3. If the query fails, continue best-effort as today; the acceptance itself must not fail because of task creation.
4. Leave the `sent` follow-up task behavior unchanged.

## Verification

- Add a regression unit test for retrying accepted side effects when a documentation task already exists.
- Run focused proposal action tests.
- Run typecheck, lint, test suite and build before merge.
