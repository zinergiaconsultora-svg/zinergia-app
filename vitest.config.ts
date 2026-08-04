import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import os from 'os'
import path from 'path'

// Vitest defaults to one fork per core. On a loaded machine that oversubscribes badly and
// the run dies with "Failed to start forks worker / Timeout waiting for worker to respond"
// - zero test failures, but a red gate. Leaving headroom keeps the suite deterministic,
// which matters more here than shaving wall-clock off an already-parallel run.
const MAX_FORKS = Math.max(2, Math.min(6, Math.floor((os.cpus()?.length ?? 4) / 2)))

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
        // The default 5s is not enough for the heavier suites once the whole
        // project runs in parallel: they pass in isolation and time out under
        // load, which makes `npm run verify` fail non-deterministically.
        testTimeout: 20000,
        hookTimeout: 20000,
        // Vitest 4 removed `poolOptions`; worker limits are top-level now.
        maxWorkers: MAX_FORKS,
        include: ['src/**/*.{test,spec}.{ts,tsx}'],
        exclude: [
            'e2e/**',
            '**/node_modules/**',
            '.next/**',
            'opencode/**',
            '.claude/**',
            '.agent/**',
            '.agents/**',
            'tasks/**',
        ],
        setupFiles: ['./vitest.setup.ts'],
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        coverage: {
            provider: 'v8',
            // Counts only files imported during tests (default). Acts as a
            // regression ratchet on the code that IS tested, rather than a
            // whole-app gate that would block on the untested UI layer.
            reporter: ['text-summary', 'json-summary'],
            exclude: [
                '**/__tests__/**',
                '**/*.{test,spec}.{ts,tsx}',
                '**/*.config.{ts,js,mjs}',
                'src/types/**',
                // Integration boundaries are covered by focused tests but
                // excluded from the global ratchet so imported framework
                // wrappers do not dominate domain coverage.
                'src/app/actions/**',
                'src/services/simulatorService.ts',
                'src/lib/auth/permissions.ts',
                'src/lib/crm/syncClientStatus.ts',
                'src/lib/utils/logger.ts',
                'e2e/**',
            ],
            // Ratchet: set just below the measured baseline (2026-06-16:
            // stmts 67.4 / branches 58.3 / funcs 82.9 / lines 67.1). Raise as
            // coverage improves; never lower without justification.
            thresholds: {
                statements: 65,
                branches: 55,
                functions: 80,
                lines: 65,
            },
        },
    },
})
