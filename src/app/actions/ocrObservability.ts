'use server';

import { requireServerRole } from '@/lib/auth/permissions';
import { createClient } from '@/lib/supabase/server';
import {
    buildOcrObservabilityMetrics,
    type OcrObservabilityMetrics,
    type OcrObservabilityRow,
} from '@/lib/ocr/observability';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getOcrObservabilityAction(): Promise<OcrObservabilityMetrics> {
    await requireServerRole(['admin']);
    const supabase = await createClient();

    const since = new Date(Date.now() - 30 * DAY_MS).toISOString();
    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('id, status, created_at, updated_at, attempts, error_message, agent_id, drive_synced_at, compared_at')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(5000);

    if (error) {
        throw new Error(`Error obteniendo observabilidad OCR: ${error.message}`);
    }

    return buildOcrObservabilityMetrics((data ?? []) as OcrObservabilityRow[], new Date());
}
