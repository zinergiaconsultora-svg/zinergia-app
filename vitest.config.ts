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
    },
})
