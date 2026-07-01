# Design - Alta History Local Refresh

Feature: `alta-history-local-refresh`

Status: `approved`

## Finding

`ExpedienteAlta` loads alta events on mount and when `expediente.altaStatus` changes. After a successful action it calls `onRefresh()`, so the visible history depends on the parent fetch and a prop update. That can leave the history count stale in the active expediente while the parent refresh is pending or if the selected object identity is preserved.

## Approach

Keep the server actions unchanged and make the component own its displayed history refresh:

1. Extract the existing `getAltaEvents(expediente.id)` call into a memoized `refreshEvents()` helper.
2. Use that helper from the mount/status effect.
3. Await `refreshEvents()` after successful button actions before invoking `onRefresh()`.
4. Trigger the same refresh after a successful reject modal callback.
5. Add a focused React Testing Library regression around `Confirmar consentimiento` and the visible `Historial (n)` counter.

## Verification

- Focused Vitest for `src/features/admin/components/__tests__/ExpedienteAlta.test.tsx`.
- SDD validator, typecheck, lint, full tests and build.
