# Design - Alta Accepted State Guards

Feature: `alta-accepted-state-guards`

Status: `approved`

## Finding

The database trigger initializes `alta_status = pendiente_consent` when a proposal transitions to `accepted`, and the admin view `proposals_alta` filters `p.status = 'accepted'`.

`confirmConsent(...)` already constrains the update with `status = accepted`, but later server actions rely primarily on `alta_status`. If data drift or a manual repair leaves alta fields on a non-accepted proposal, later actions could move the alta state.

## Approach

Keep the current state machine and UI. Add explicit `status = accepted` guards to all alta mutations:

- `requestAlta(...)`: load `status` in the pre-check and require accepted before requesting alta; include `eq('status', 'accepted')` in the update.
- `completeAlta(...)`: include `eq('status', 'accepted')` in the update.
- `rejectAlta(...)`: include `eq('status', 'accepted')` in the update.
- `reopenAlta(...)`: load `status` in the pre-check and require accepted before reopening; include `eq('status', 'accepted')` in the update.

Add focused unit tests to prove non-accepted proposals are rejected and do not write audit events.

## Verification

- Focused Vitest for `src/app/actions/alta.ts`.
- SDD validator, typecheck, lint, test suite and build.
