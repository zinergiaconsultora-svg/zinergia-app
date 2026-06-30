# Design - Acceptance Side Effects Idempotency

Feature: `acceptance-side-effects-idempotency`

Status: `approved`

## Current Finding

`updateProposalStatusAction(id, 'accepted')` calls `finalizeAcceptedProposalSideEffects(...)`. That finalizer already processes commissions, closes the lead, creates accepted follow-up tasks and creates the contract. After returning, `updateProposalStatusAction` calls `generateFollowUpTasks(...)` again with status `accepted`, which can duplicate the accepted documentation task.

## Approach

Keep the existing shared finalizer as the single source for accepted side effects.

1. Add a focused unit regression for authenticated acceptance.
2. Update `updateProposalStatusAction` so the post-status notification/activity code remains, but extra follow-up task generation only runs for non-accepted statuses.
3. Leave public acceptance unchanged because it already calls the shared finalizer once after atomic acceptance.

## Security

- No schema changes.
- No new service-role boundaries.
- The test uses fake IDs and no real PII.

## Verification

- Focused Vitest for `updateProposalStatusAction`.
- Existing public proposal action tests.
- SDD validator, lint and type check.
