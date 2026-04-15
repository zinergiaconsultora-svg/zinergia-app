'use server';

import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireServerRole } from '@/lib/auth/permissions';
import {
    aggregateOcrMetrics,
    emptyOcrMetrics,
    type OcrJobRow,
    type OcrMetrics,
} from '@/lib/ocr/metrics';

export type { OcrMetrics, OcrMetricsDaily, OcrErrorSummary } from '@/lib/ocr/metrics';

export async function getOcrMetrics(windowDays = 30): Promise<OcrMetrics> {
    await requireServerRole(['admin', 'franchise']);

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!serviceKey) return emptyOcrMetrics(windowDays);

    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);

    const since = new Date();
    since.setUTCDate(since.getUTCDate() - windowDays);
    since.setUTCHours(0, 0, 0, 0);

    const { data, error } = await admin
        .from('ocr_jobs')
        .select('status, created_at, error_message')
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true })
        .limit(10_000);

    if (error || !data) {
        console.error('[OCR Metrics] Query failed:', error?.message);
        return emptyOcrMetrics(windowDays);
    }

    return aggregateOcrMetrics(data as OcrJobRow[], windowDays);
}
