# ZIN-SDD-035 — Design

## Scope

Fix authenticated proposal acceptance attribution in `src/app/actions/proposals.ts`.

## Current Behavior

`processCommissions`, accepted follow-up task creation, and contract creation already use `proposal.agent_id ?? actorId`.

However `updateProposalStatusAction` passes `user.id` to:

- `createStatusNotification(...)`
- `logProposalActivity(...)`

For admin/franchise acceptance, this can associate notification/timeline ownership with the admin/franchise actor instead of the proposal owner.

## Proposed Change

- After the proposal update, compute:
  - `ownerAgentId = proposal.agent_id ?? user.id`
- Pass `ownerAgentId` to notification and timeline logging.
- Continue passing `user.id` into `finalizeAcceptedProposalSideEffects(...)` so lead audit actor remains the authenticated actor.
- Leave status scoping rules unchanged:
  - agent limited by `agent_id`
  - franchise limited by `franchise_id`
  - admin global

## Tests

- Add a unit test where actor is admin and proposal owner is a different agent.
- Assert:
  - commission belongs to proposal agent
  - task belongs to proposal agent
  - notification targets proposal agent
  - timeline activity uses proposal agent
  - lead audit actor is admin actor

## Rollback

Revert the one-line owner id routing change and the associated test/spec docs.
