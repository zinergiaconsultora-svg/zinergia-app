# ZIN-SDD-035 — Acceptance owner attribution

## Requirements

- [REQ-001] WHEN an admin or franchise user accepts a proposal owned by an agent, the system shall keep commission, accepted task, contract, notification, and client timeline ownership on the proposal agent.
- [REQ-002] WHEN an authenticated actor accepts a proposal, the lead audit event shall continue to record the authenticated actor as the actor.
- [REQ-003] IF a proposal has no `agent_id`, THEN the system may fall back to the authenticated actor for backward compatibility.
- [REQ-004] The change shall not alter proposal status authorization rules, commission amount calculation, public proposal acceptance, or database schema.

## Properties

- No schema migration is required.
- Business ownership (`agent_id`) and audit actor (`actorId`) must remain distinct.
- The fix must be covered by focused unit tests.
