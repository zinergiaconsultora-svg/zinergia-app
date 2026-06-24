/**
 * RGPD cascade (wired) — deletes the Drive invoice files belonging to a set of
 * clients about to be erased. MUST run BEFORE the DB delete, because
 * ocr_jobs.client_id is ON DELETE CASCADE: once the client row goes, the
 * drive_file_ids are gone with it.
 *
 * Best-effort and audited: each deletion writes an audit_logs entry; failures
 * are counted (the reconciliation job cleans up any stragglers).
 */

import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/audit/logger';
import { logger } from '@/lib/utils/logger';
import { getDriveStorage, isDriveConfigured } from './index';
import { purgeDriveFiles } from './purgeDriveFiles';

export async function purgeClientDriveFiles(
    clientIds: string[],
): Promise<{ deleted: number; failed: number }> {
    if (!isDriveConfigured() || clientIds.length === 0) {
        return { deleted: 0, failed: 0 };
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
        .from('ocr_jobs')
        .select('id, drive_file_id')
        .in('client_id', clientIds)
        .not('drive_file_id', 'is', null);

    if (error) {
        logger.warn('[Drive] Could not list files for RGPD purge', { error: error.message });
        return { deleted: 0, failed: 0 };
    }

    const files = (data ?? [])
        .filter((r): r is { id: string; drive_file_id: string } => Boolean(r.drive_file_id))
        .map((r) => ({ jobId: r.id, driveFileId: r.drive_file_id }));

    if (files.length === 0) return { deleted: 0, failed: 0 };

    const drive = await getDriveStorage();

    return purgeDriveFiles({
        files,
        deleteFile: (driveFileId) => drive.deleteInvoice(driveFileId),
        audit: (jobId, driveFileId) =>
            logAdminAction('rgpd_drive_deletion', 'ocr_jobs', jobId, {
                driveFileId,
                reason: 'client_erasure',
                deleted_at: new Date().toISOString(),
            }).catch(() => undefined),
    });
}
