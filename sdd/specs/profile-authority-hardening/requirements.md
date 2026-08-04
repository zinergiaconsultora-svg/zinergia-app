# Profile Authority Hardening Requirements

Feature: `ZIN-SDD-041 profile-authority-hardening`.

Status: `requirements_ready`; SDD Gate 1 approved by the product owner on 2026-08-03.

## Intent

Ensure no authenticated user can elevate or reassign their own authority through
the profile row. Self-service identity updates remain simple, while role,
hierarchy, franchise and protected fiscal/economic authority change only through
explicit Admin server workflows or the closed purpose-bound invitation/bootstrap
matrix, with immutable audit evidence.

## Current evidence

- The versioned baseline policy `Users can update own profile` uses only
  `auth.uid() = id` and does not constrain updated columns.
- `profiles` contains `role`, `parent_id` and `franchise_id`; later workflows
  derive authorization and economic behavior from profile data.
- Effective `authenticated` grants on the linked database have not yet been
  verified in this planning session. Exploitability is therefore a blocking
  hypothesis, while the policy's missing protected-column boundary is confirmed.

## Scope

In scope:

- Effective grants and policies for profile reads/updates through Data API.
- Explicit self-service field allowlist.
- Protected role, hierarchy, franchise, fiscal-verification and economic assignment fields.
- Admin server mutation plus the closed purpose-bound invitation/bootstrap exception, both validated and append-only audited.
- Agent/Franchise/Admin direct REST and workflow tests.
- Migration/RLS/privilege/type changes required by the final design.

Out of scope:

- New roles or organization levels.
- Redesigning team administration.
- Changing commission percentages or historical economic assignments.
- Rewriting authentication or invitation flows beyond the protected boundary.

## Requirements

[REQ-001] WHEN an authenticated user updates their own profile, the system shall allow only the approved self-service fields `full_name`, `phone`, `bio` and `timezone` through a protected server workflow.

Verification:

- Direct REST updates to protected and non-allowlisted columns fail.
- The normal profile form still updates the four approved fields.
- Payload fields outside the allowlist are rejected, not silently persisted.

[REQ-002] WHEN any actor attempts to change `role`, `parent_id`, `franchise_id`, fiscal verification, economic channel/assignment or equivalent authority-bearing fields, the system shall require an authorized Admin workflow or an explicit bootstrap/invitation workflow whose protected values are derived only from validated server-side records.

Verification:

- Agent and Franchise cannot change those fields on themselves or another profile.
- Admin changes validate target, allowed transition and organization consistency.
- No client-supplied role is trusted as authorization for the same request.
- Invitation/bootstrap inputs never accept client-selected authority, cannot create an Admin and are consumed atomically and idempotently. Admin may invite an Agent or Franchise; a Franchise may invite only an Agent attached to its own validated network.

[REQ-003] WHEN an authorized Admin changes profile authority or hierarchy, the system shall append immutable audit evidence with actor, target, safe before/after values, reason and time.

Verification:

- Missing reason or invalid transition is rejected.
- Audit contains no secrets and does not duplicate on retry.
- Historical commission allocation snapshots are unchanged.

[REQ-004] WHILE authorization is evaluated, the system shall derive the actor's role and scope from server-trusted state and shall fail closed if the profile is missing, invalid or ambiguous.

Verification:

- Manipulated client payload/cookie values do not affect role resolution.
- Missing/invalid profiles receive no privileged fallback.
- Role guards and RLS agree for Agent, Franchise and Admin.

[REQ-005] WHEN the feature is verified, the system shall prove effective table/column grants and policies on the linked staging database, not only inspect migration text.

Verification:

- A matrix covers anon, two same-franchise agents, another-franchise agent, Franchise and Admin.
- Direct REST attempts to self-promote, reparent or reassign franchise fail.
- Direct profile reads expose only the approved identity/relationship projection; fiscal, banking and internal-system fields require their dedicated server workflows.
- Approved self-service and Admin workflows succeed only for intended actors.

[REQ-006] WHEN database policy or privilege changes are required, the system shall use a new migration, regenerate database types and preserve existing valid profile values.

Verification:

- No applied migration is rewritten and no dashboard edit is used.
- Structural and RLS verifiers inspect effective `PUBLIC`, `anon`, `authenticated` and `service_role` privileges.
- Rollback never reopens broad self-authority updates; emergency recovery is a reviewed forward fix.

## Properties / Invariants

- [INV-001] No user can elevate, reparent or reassign their own authority.
- [INV-002] Row ownership alone never authorizes protected-column mutation.
- [INV-003] Only server-trusted role and scope may authorize a request.
- [INV-004] Authority and hierarchy changes are Admin-only except for the closed purpose-bound invitation/bootstrap matrix; every path is append-only audited.
- [INV-005] Economic and fiscal history is never rewritten by a profile-authority change.
- [INV-006] RLS and grants remain effective against direct Data API access.

## Success criteria

- The full role/tenancy REST matrix passes on staging.
- Approved profile self-service remains functional with an explicit four-field allowlist.
- Every protected change is rejected or produces one authorized, reasoned audit event.
- TypeScript, lint, unit/integration tests and production build pass.

## Product decisions confirmed during design

- The self-service allowlist remains exactly `full_name`, `phone`, `bio` and `timezone`; no additional profile column is implicitly safe.
- Direct Data API `INSERT`, `UPDATE` and `DELETE` on `profiles` are not a supported product interface for authenticated users. All writes use explicit server workflows.
- Direct Data API `SELECT` is column-limited to the approved directory/authority projection; fiscal, banking and system columns are never exposed through network/profile-directory reads. Contact fields remain PII and retain row/role scoping.
- A Franchise may correct only `full_name` for a subordinate in its validated network through a scoped identity workflow. It cannot change authority, deactivate accounts or write `profiles.email`.
- `profiles.email` remains an Auth-owned mirror. Email change is a separate future identity workflow and is not implemented by this feature.
- Fiscal, IBAN, Drive and invoice-number mutations remain dedicated workflows; they are not folded into self-service or authority mutation.
