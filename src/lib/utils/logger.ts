/**
 * Browser-safe logging facade.
 *
 * Keep this module dependency-free: it is imported by client hooks/components.
 * Server-only structured logging should import `@/lib/logger` directly.
 */

const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
    'address',
    'authorization',
    'cif',
    'cookie',
    'cups',
    'dni',
    'dni_cif',
    'email',
    'extracted_fields',
    'nif',
    'password',
    'raw_fields',
    'supply_address',
    'token',
]);

function sanitize(value: unknown): unknown {
    if (!value || typeof value !== 'object') return value;
    if (value instanceof Error) return { name: value.name, message: value.message };
    if (Array.isArray(value)) return value.slice(0, 10).map(sanitize);

    const output: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
        output[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? REDACTED : sanitize(entry);
    }
    return output;
}

function write(level: 'error' | 'warn' | 'info', message: string, error?: unknown, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV === 'test') return;

    const payload = {
        ...(context ? (sanitize(context) as Record<string, unknown>) : {}),
        ...(error === undefined ? {} : { err: sanitize(error) }),
    };

    if (Object.keys(payload).length > 0) {
        console[level](message, payload);
        return;
    }

    console[level](message);
}

export const logger = {
    error: (message: string, error?: unknown, context?: Record<string, unknown>) => write('error', message, error, context),
    warn: (message: string, context?: Record<string, unknown>) => write('warn', message, undefined, context),
    info: (message: string, context?: Record<string, unknown>) => write('info', message, undefined, context),
};
