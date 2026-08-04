import { configure } from '@testing-library/react'

// Testing Library waits 1s by default for findBy*/waitFor. That is plenty on an idle
// machine and not enough once the whole suite runs in parallel: component tests that pass
// in isolation fail with "Unable to find role=..." purely because a state update had not
// settled yet. Raising the ceiling does not change the behaviour of a passing assertion,
// it only stops a loaded machine from turning a green suite red.
//
// Cost: this file is loaded once per test file, including pure-Node ones that never touch
// the DOM. If suite wall-clock becomes a problem on CI, the cheaper alternative is to drop
// this file and put explicit `{ timeout: 5000 }` on the specific findBy* calls that flake.
configure({ asyncUtilTimeout: 5000 })
