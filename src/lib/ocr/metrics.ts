/**
 * Pure helpers for OCR metrics aggregation.
 *
 * Kept separate from the 'use server' action so they can be unit-tested
 * without touching Supabase, and because server actions require all exports
 * to be async functions.
 */

export interface OcrMetricsDaily {
    /** YYYY-MM-DD */
    day: string;
    total: number;
    completed: number;
    failed: number;
}

export interface OcrErrorSummary {
    message: string;
    count: number;
}

export interface OcrMetrics {
    windowDays: number;
    total: number;
    completed: number;
    failed: number;
    processing: number;
    /** 0–1 among completed+failed (jobs that reached a terminal state). */
    successRate: number;
    /** Jobs per day, oldest-first, with zero-filled gaps. */
    daily: OcrMetricsDaily[];
    /** Most common error messages (top 5), normalized. */
    topErrors: OcrErrorSummary[];
}

export interface OcrJobRow {
    status: 'processing' | 'completed' | 'failed';
    created_at: string;
    error_message: string | null;
}

/**
 * Normalize error messages so similar ones group together.
 * Strips UUIDs, HTTP status codes, and timestamps so that e.g.
 * "N8N rechazó el retry: HTTP 502" and "N8N rechazó el retry: HTTP 504" group.
 */
export function normalizeError(msg: string): string {
    return msg
        .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '<uuid>')
        .replace(/HTTP \d{3}/g, 'HTTP <code>')
        .replace(/\b\d{13,}\b/g, '<timestamp>')
        .trim()
        .slice(0, 140);
}

/**
 * Build zero-filled per-day buckets covering [today - windowDays + 1, today].
 * Oldest bucket first; today last.
 */
export function zeroFillDays(rows: OcrJobRow[], windowDays: number, now: Date = new Date()): OcrMetricsDaily[] {
    const buckets = new Map<string, OcrMetricsDaily>();
    const today = new Date(now);
    today.setUTCHours(0, 0, 0, 0);

    for (let i = windowDays - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setUTCDate(today.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10);
        buckets.set(key, { day: key, total: 0, completed: 0, failed: 0 });
    }

    for (const row of rows) {
        const key = row.created_at.slice(0, 10);
        const bucket = buckets.get(key);
        if (!bucket) continue; // outside window
        bucket.total++;
        if (row.status === 'completed') bucket.completed++;
        else if (row.status === 'failed') bucket.failed++;
    }

    return [...buckets.values()];
}

export function emptyOcrMetrics(windowDays: number): OcrMetrics {
    return {
        windowDays,
        total: 0,
        completed: 0,
        failed: 0,
        processing: 0,
        successRate: 0,
        daily: zeroFillDays([], windowDays),
        topErrors: [],
    };
}

export function aggregateOcrMetrics(rows: OcrJobRow[], windowDays: number): OcrMetrics {
    let completed = 0;
    let failed = 0;
    let processing = 0;
    const errorCounts = new Map<string, number>();

    for (const row of rows) {
        if (row.status === 'completed') completed++;
        else if (row.status === 'failed') {
            failed++;
            if (row.error_message) {
                const key = normalizeError(row.error_message);
                errorCounts.set(key, (errorCounts.get(key) ?? 0) + 1);
            }
        } else if (row.status === 'processing') processing++;
    }

    const terminal = completed + failed;
    const topErrors = [...errorCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([message, count]) => ({ message, count }));

    return {
        windowDays,
        total: rows.length,
        completed,
        failed,
        processing,
        successRate: terminal > 0 ? completed / terminal : 0,
        daily: zeroFillDays(rows, windowDays),
        topErrors,
    };
}
