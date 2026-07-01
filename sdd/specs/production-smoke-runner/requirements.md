# Requirements: Production Smoke Runner

## Scope

Make the post-deploy production smoke check repeatable without pasting credentials into terminal commands or accidentally using staging fixtures against production.

## Requirements

- [REQ-001] WHEN an operator runs the production smoke command without credentials, the system shall validate only unauthenticated production behavior.
- [REQ-002] WHEN an operator provides commercial/admin credentials, the command shall pass them to Playwright through process environment variables populated from prompts, not command-line literals.
- [REQ-003] The command shall target production by default and shall not start the local staging dev server.
- [REQ-004] The command shall restore any previous E2E-related environment variables after it finishes.

## Invariants

- No production password is committed, echoed, or embedded in npm scripts.
- The smoke suite remains non-mutating by default.
- Staging fixture tokens must not be required for production smoke.
