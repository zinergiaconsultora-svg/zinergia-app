type LogLevel = 'error' | 'warn' | 'info';

interface LogEntry {
    level: LogLevel;
    message: string;
    error?: unknown;
    context?: Record<string, unknown>;
    timestamp: string;
}

function formatLog(entry: LogEntry): string {
    const ts = entry.timestamp;
    const lvl = entry.level.toUpperCase();
    const ctx = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
    const err = entry.error instanceof Error ? ` | ${entry.error.message}` : '';
    return `[${ts}] ${lvl}: ${entry.message}${ctx}${err}`;
}

function log(level: LogLevel, message: string, error?: unknown, context?: Record<string, unknown>) {
    const entry: LogEntry = {
        level,
        message,
        error,
        context,
        timestamp: new Date().toISOString(),
    };

    if (level === 'error') {
        console.error(formatLog(entry), error instanceof Error ? error.stack : '');
    } else if (level === 'warn') {
        console.warn(formatLog(entry));
    } else {
        console.info(formatLog(entry));
    }
}

export const logger = {
    error: (message: string, error?: unknown, context?: Record<string, unknown>) =>
        log('error', message, error, context),
    warn: (message: string, context?: Record<string, unknown>) =>
        log('warn', message, undefined, context),
    info: (message: string, context?: Record<string, unknown>) =>
        log('info', message, undefined, context),
};
