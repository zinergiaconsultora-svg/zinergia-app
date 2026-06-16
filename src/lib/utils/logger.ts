/**
 * Lightweight logging facade.
 *
 * Delegates to the structured pino logger in `@/lib/logger`, which:
 *   - emits structured JSON in production (stdout → Vercel log drain),
 *   - redacts PII fields (cups, dni_cif, email, address, tokens, …),
 *   - stays silent under NODE_ENV=test so test output stays clean.
 *
 * The `(message, error?, context?)` signature is kept for backwards
 * compatibility with existing callers. Prefer importing `moduleLogger` from
 * `@/lib/logger` directly in new code for a bound module name.
 */

import { logger as structured } from '@/lib/logger';

export const logger = {
    error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
        structured.error({ ...(context ?? {}), err: error }, message),
    warn: (message: string, context?: Record<string, unknown>) =>
        structured.warn({ ...(context ?? {}) }, message),
    info: (message: string, context?: Record<string, unknown>) =>
        structured.info({ ...(context ?? {}) }, message),
};
