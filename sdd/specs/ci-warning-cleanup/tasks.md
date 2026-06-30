# Tasks: CI Warning Cleanup

## Implementation Tasks

- [ ] Task 1: Fix the realtime hook dependency warning in `OcrJobsPanel.tsx`.
  - Traceability: `REQ-001`, `REQ-003`, `REQ-004`.
  - Change: add the stable `router` dependency to the realtime `useEffect` dependency list without altering subscription behavior.

- [ ] Task 2: Remove unused Annual Audit summary parameter.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-004`.
  - Change: remove the unused `profile` parameter from `buildExecutiveSummary` and its call site.

- [ ] Task 3: Remove unused Simulator Hero symbols.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-004`.
  - Change: remove `AnimatePresence` import and unused `confirmBtn` JSX local.

- [ ] Task 4: Remove unused Aletheia helpers/constants.
  - Traceability: `REQ-001`, `REQ-002`, `REQ-004`.
  - Change: remove `REACTIVE_PRICE_EUR_KVARH` and `nb`.

- [ ] Task 5: Verify and close SDD feature.
  - Traceability: all requirements.
  - Run: `npm run lint`, `npx tsc --noEmit`, `npm run test`, `node sdd/scripts/validate-sdd.mjs`.
  - Update: `feature_list.json`, `progress/current.md`, `progress/history.md`.

