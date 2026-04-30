/**
 * Structured application logger.
 *
 * Uses pino in production/development for structured JSON logs.
 * Falls back to a no-op in the test environment so test output stays clean.
 *
 * Usage:
 *   import { logger } from '@/lib/logger';
 *   logger.info({ jobId, status }, 'OCR job completed');
 *   logger.error({ err, requestId }, 'Callback failed');
 *
 * In production, emit to stdout → Vercel Log Drain → Datadog/Axiom/Logflare.
 */

import pino from 'pino';
import type { Logger } from 'pino';

// ── Factory ───────────────────────────────────────────────────────────────────

function createLogger(): Logger {
    const isTest = process.env.NODE_ENV === 'test';
    const isDev = process.env.NODE_ENV === 'development';

    if (isTest) {
        // Silent logger: pino with level 'silent' swallows all output
        return pino({ level: 'silent' });
    }

    return pino({
        level: isDev ? 'debug' : 'info',
        // In dev, use pretty-printable output. In prod, structured JSON.
        ...(isDev
            ? {
                  transport: {
                      target: 'pino/file',
                      options: { destination: 1 }, // stdout
                  },
              }
            : {}),
        base: {
            env: process.env.NODE_ENV,
        },
        timestamp: pino.stdTimeFunctions.isoTime,
        formatters: {
            level(label) {
                return { level: label };
            },
        },
        // Redact PII fields that should never appear in logs
        redact: {
            paths: [
                'cups',
                'dni',
                'email',
                'password',
                'token',
                'authorization',
                'cookie',
                '*.cups',
                '*.dni',
                '*.email',
            ],
            censor: '[REDACTED]',
        },
    });
}

export const logger = createLogger();

// ── Convenience child factories ───────────────────────────────────────────────

/** Create a child logger bound to a specific request ID */
export function requestLogger(requestId: string) {
    return logger.child({ requestId });
}

/** Create a child logger bound to a named module */
export function moduleLogger(module: string) {
    return logger.child({ module });
}
