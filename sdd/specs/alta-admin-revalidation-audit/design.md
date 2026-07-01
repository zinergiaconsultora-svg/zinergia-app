# Design - Alta Admin Revalidation Audit

Feature: `alta-admin-revalidation-audit`

Status: `approved`

## Finding

`AltaPendingPanel` is rendered on the admin dashboard, but successful alta mutations currently call only `revalidatePath('/dashboard')`. The panel also fetches `proposal_alta_events` for visible history. If server cache is stale, admin can see delayed state/history after a mutation.

## Approach

Keep the UI as-is and update server actions:

1. Add a small `revalidateAltaPaths()` helper in `src/app/actions/alta.ts`.
2. Revalidate both `/admin` and `/dashboard` after successful alta mutations.
3. Preserve the existing best-effort audit writes.
4. Add focused tests that assert successful transitions revalidate admin/dashboard paths and failed guards do not.

## Verification

- Focused Vitest for `src/app/actions/__tests__/alta.test.ts`.
- SDD validator, typecheck, lint, full tests and build.
