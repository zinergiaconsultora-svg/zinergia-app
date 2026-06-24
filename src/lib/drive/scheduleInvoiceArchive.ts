/**
 * Wired, non-blocking entry point for archiving an OCR job's invoice to Drive.
 *
 * Called by the OCR server action right after the ocr_jobs row is created. Runs
 * the upload AFTER the response (next/server `after`) so it adds no latency, is
 * idempotent per job (only when drive_synced_at IS NULL), and never breaks the
 * OCR flow — failures are logged and left for the reconciliation job.
 */

import { after } from 'next/server';
import { logger } from '@/lib/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';
import { archiveInvoiceToDrive } from './archiveInvoice';
import { getDriveStorage, getDriveRootFolderId, isDriveConfigured } from './index';
import { resolveAgentFolder } from './folders';

interface ScheduleInvoiceArchiveInput {
    jobId: string;
    agentId: string;
    file: File;
    invoiceDate?: string | Date;
}

export async function scheduleInvoiceArchive(
    supabase: SupabaseClient,
    { jobId, agentId, file, invoiceDate }: ScheduleInvoiceArchiveInput,
): Promise<void> {
    // No-op when Drive isn't configured — doubles as the feature flag.
    if (!isDriveConfigured()) return;

    // Read the bytes within the request (the File may not outlive it); everything
    // else (hashing, DB, Drive) runs after the response so it adds no latency.
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type;

    after(async () => {
        try {
            // Idempotency: skip if another run already archived this job.
            const { data: job } = await supabase
                .from('ocr_jobs')
                .select('drive_synced_at')
                .eq('id', jobId)
                .single();
            if (job?.drive_synced_at) return;

            const drive = await getDriveStorage();
            const rootFolderId = getDriveRootFolderId();

            await archiveInvoiceToDrive({
                jobId,
                agentId,
                fileBuffer: buffer,
                mimeType,
                invoiceDate,
                rootFolderId,
                drive,
                resolveFolder: (id) => resolveAgentFolder(drive, rootFolderId, id),
                markSynced: async (id, info) => {
                    await supabase
                        .from('ocr_jobs')
                        .update({
                            drive_file_id: info.driveFileId,
                            drive_view_link: info.webViewLink,
                            drive_synced_at: new Date().toISOString(),
                        })
                        .eq('id', id);
                },
            });
        } catch (err) {
            // Leave drive_synced_at NULL → the reconciliation job will retry.
            logger.warn('[Drive] Invoice archive failed (will reconcile)', {
                jobId,
                err: err instanceof Error ? err.message : String(err),
            });
        }
    });
}
