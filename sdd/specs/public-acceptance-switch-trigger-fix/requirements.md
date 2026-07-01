# Requirements - Public Acceptance Switch Trigger Fix

Feature: `public-acceptance-switch-trigger-fix`

Status: `approved`

## Intent

Fix the staging E2E failure where accepting a public proposal fails with `record "new" has no field "closed_company"` from `public.auto_log_switch_event()`.

## EARS Requirements

- [REQ-001] WHEN a proposal transitions to `accepted`, the switch-event trigger shall not reference columns that do not exist on `public.proposals`.
- [REQ-002] WHEN a proposal has marketer data in `offer_snapshot`, the switch event shall use it as `new_marketer`.
- [REQ-003] IF no marketer data is available, THEN the switch event shall use a safe fallback value.
- [REQ-004] WHEN the fix is applied, public proposal acceptance E2E shall complete and create the expected business side effects.

## Properties

- [INV-001] The fix shall be delivered through a Supabase migration file.
- [INV-002] Production shall not be mutated during local verification unless explicitly requested.
