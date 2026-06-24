/**
 * Reconciliation — retries Drive archiving for OCR jobs left unsynced.
 *
 * Safety net for the non-blocking archive (scheduleInvoiceArchive): if a Drive
 * upload failed or the request died before `after()` ran, the job stays with
 * drive_synced_at = NULL. This job re-downloads the original file from Storage
 * and retries the upload. Run on a daily cron.
 *
 * Best-effort: a failure on one job never stops the rest.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { logger } from '@/lib/utils/logger';
import { archiveInvoiceToDrive } from './archiveInvoice';
import { mimeTypeForFileName } from './fileName';
import { extractStoragePath } from './storagePath';
import { resolveAgentFolder } from './folders';
import { getDriveStorage, getDriveRootFolderId, isDriveConfigured } from './index';

const STORAGE_BUCKET = 'ocr-invoices';

export interface ReconcileResult {
    processed: number;
    archived: number;
    failed: number;
}

export async function reconcilePendingDriveArchives(limit = 25): Promise<ReconcileResult> {
    if (!isDriveConfigured()) return { processed: 0, archived: 0, failed: 0 };

    const supabase = createServiceClient();
    const { data: jobs, error } = await supabase
        .from('ocr_jobs')
        .select('id, agent_id, file_path, file_name, extracted_data')
        .is('drive_synced_at', null)
        .is('drive_file_id', null)
        .not('file_path', 'is', null)
        .order('created_at', { ascending: true })
        .limit(limit);

    if (error) {
        logger.warn('[Drive] Reconcile query failed', { error: error.message });
        return { processed: 0, archived: 0, failed: 0 };
    }
    if (!jobs?.length) return { processed: 0, archived: 0, failed: 0 };

    const drive = await getDriveStorage();
    const rootFolderId = getDriveRootFolderId();
    let archived = 0;
    let failed = 0;

    for (const job of jobs) {
        try {
            const path = job.file_path ? extractStoragePath(job.file_path, STORAGE_BUCKET) : null;
            if (!path) {
                failed++;
                continue;
            }
            const { data: blob, error: dlError } = await supabase.storage
                .from(STORAGE_BUCKET)
                .download(path);
            if (dlError || !blob) {
                failed++;
                continue;
            }
            const buffer = Buffer.from(await blob.arrayBuffer());
            const fileName = job.file_name ?? 'factura.pdf';
            const invoiceDate = (job.extracted_data as Record<string, unknown> | null)?.invoice_date as
                | string
                | undefined;

            await archiveInvoiceToDrive({
                jobId: job.id,
                agentId: job.agent_id,
                fileBuffer: buffer,
                mimeType: mimeTypeForFileName(fileName),
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
            archived++;
        } catch (err) {
            failed++;
            logger.warn('[Drive] Reconcile: job archive failed', {
                jobId: job.id,
                err: err instanceof Error ? err.message : String(err),
            });
        }
    }

    return { processed: jobs.length, archived, failed };
}
