export interface OcrObservabilityRow {
    id: string;
    status: 'processing' | 'completed' | 'failed' | string;
    created_at: string;
    updated_at: string;
    attempts: number | null;
    error_message: string | null;
    agent_id: string | null;
    drive_synced_at: string | null;
    compared_at: string | null;
}

export interface OcrStatusSummary {
    total: number;
    completed: number;
    failed: number;
    processing: number;
    completionRate: number;
    failureRate: number;
}

export interface OcrErrorBucket {
    message: string;
    count: number;
}

export interface OcrDailyTrendPoint {
    date: string;
    created: number;
    completed: number;
    failed: number;
}

export interface OcrObservabilityMetrics {
    generatedAt: string;
    last24h: OcrStatusSummary;
    last7d: OcrStatusSummary;
    last30d: OcrStatusSummary;
    processingNow: number;
    staleProcessing: number;
    retryPressure: number;
    affectedAgents30d: number;
    driveArchiveCoverage: number;
    comparisonCoverage: number;
    frequentErrors: OcrErrorBucket[];
    dailyTrend: OcrDailyTrendPoint[];
}

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_PROCESSING_MS = 15 * 60 * 1000;

export function buildOcrObservabilityMetrics(
    rows: OcrObservabilityRow[],
    now: Date,
): OcrObservabilityMetrics {
    const nowMs = now.getTime();
    const last24hRows = filterSince(rows, nowMs - DAY_MS);
    const last7dRows = filterSince(rows, nowMs - 7 * DAY_MS);
    const last30dRows = filterSince(rows, nowMs - 30 * DAY_MS);
    const completed30d = last30dRows.filter(row => row.status === 'completed');

    return {
        generatedAt: now.toISOString(),
        last24h: summarizeStatus(last24hRows),
        last7d: summarizeStatus(last7dRows),
        last30d: summarizeStatus(last30dRows),
        processingNow: last30dRows.filter(row => row.status === 'processing').length,
        staleProcessing: last30dRows.filter(row => isStaleProcessing(row, nowMs)).length,
        retryPressure: last30dRows.filter(row => (row.attempts ?? 0) > 1).length,
        affectedAgents30d: new Set(last30dRows.map(row => row.agent_id).filter(Boolean)).size,
        driveArchiveCoverage: ratio(
            completed30d.filter(row => row.drive_synced_at !== null).length,
            completed30d.length,
        ),
        comparisonCoverage: ratio(
            completed30d.filter(row => row.compared_at !== null).length,
            completed30d.length,
        ),
        frequentErrors: buildFrequentErrors(last30dRows),
        dailyTrend: buildDailyTrend(last30dRows, now),
    };
}

export function normalizeOcrErrorMessage(message: string | null): string {
    if (!message) return 'Error no especificado';

    const normalized = message
        .replace(/\b[A-Z]{2}[A-Z0-9]{16,22}\b/gi, '[CUPS]')
        .replace(/\b\d{8}[A-Z]\b/gi, '[DNI]')
        .replace(/\b[A-Z]\d{7}[A-Z0-9]\b/gi, '[CIF]')
        .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[ID]')
        .replace(/https?:\/\/\S+/gi, '[URL]')
        .replace(/\b[\w.+-]+@[\w.-]+\.\w+\b/gi, '[EMAIL]')
        .replace(/\s+/g, ' ')
        .trim();

    if (!normalized) return 'Error no especificado';
    return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

function filterSince(rows: OcrObservabilityRow[], sinceMs: number): OcrObservabilityRow[] {
    return rows.filter(row => new Date(row.created_at).getTime() >= sinceMs);
}

function summarizeStatus(rows: OcrObservabilityRow[]): OcrStatusSummary {
    const completed = rows.filter(row => row.status === 'completed').length;
    const failed = rows.filter(row => row.status === 'failed').length;
    const processing = rows.filter(row => row.status === 'processing').length;

    return {
        total: rows.length,
        completed,
        failed,
        processing,
        completionRate: ratio(completed, rows.length),
        failureRate: ratio(failed, rows.length),
    };
}

function isStaleProcessing(row: OcrObservabilityRow, nowMs: number): boolean {
    if (row.status !== 'processing') return false;
    const updatedAt = new Date(row.updated_at || row.created_at).getTime();
    return nowMs - updatedAt > STALE_PROCESSING_MS;
}

function buildFrequentErrors(rows: OcrObservabilityRow[]): OcrErrorBucket[] {
    const buckets = new Map<string, number>();

    for (const row of rows) {
        if (row.status !== 'failed') continue;
        const message = normalizeOcrErrorMessage(row.error_message);
        buckets.set(message, (buckets.get(message) ?? 0) + 1);
    }

    return [...buckets.entries()]
        .map(([message, count]) => ({ message, count }))
        .sort((a, b) => b.count - a.count || a.message.localeCompare(b.message))
        .slice(0, 6);
}

function buildDailyTrend(rows: OcrObservabilityRow[], now: Date): OcrDailyTrendPoint[] {
    const days = new Map<string, OcrDailyTrendPoint>();

    for (let i = 13; i >= 0; i--) {
        const date = new Date(now.getTime() - i * DAY_MS).toISOString().slice(0, 10);
        days.set(date, { date, created: 0, completed: 0, failed: 0 });
    }

    for (const row of rows) {
        const date = row.created_at.slice(0, 10);
        const point = days.get(date);
        if (!point) continue;
        point.created++;
        if (row.status === 'completed') point.completed++;
        if (row.status === 'failed') point.failed++;
    }

    return [...days.values()];
}

function ratio(part: number, total: number): number {
    return total > 0 ? Math.round((part / total) * 100) : 0;
}
