import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        globals: true,
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
        setupFiles: [],
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
