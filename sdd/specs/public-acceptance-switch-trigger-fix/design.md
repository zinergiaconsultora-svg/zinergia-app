# Design - Public Acceptance Switch Trigger Fix

Feature: `public-acceptance-switch-trigger-fix`

Status: `approved`

## Approach

Replace `public.auto_log_switch_event()` with a version that derives `new_marketer` from `proposals.offer_snapshot` instead of `NEW.closed_company`.

`closed_company` exists on `ocr_jobs`, not `proposals`, so using it inside a proposal trigger aborts the status update before public acceptance can complete.

## Data Behavior

The trigger uses this precedence:

1. `offer_snapshot->>'marketer_name'`
2. `offer_snapshot->>'company'`
3. `offer_snapshot->>'provider'`
4. `Nueva comercializadora`

The trigger then inserts `switch_events` and updates `clients.current_supplier` with the resolved marketer.

## Verification

- Apply migration to staging.
- Regenerate Supabase types if schema output changes.
- Run `npm run test:e2e:public-mutating`.
- Run local gates affected by the migration and SDD docs.
