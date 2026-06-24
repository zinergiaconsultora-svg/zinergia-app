/**
 * Wired Drive housekeeping, run daily by the reconcile cron:
 *   1. cleanupOrphanDriveFiles   — RGPD backstop: delete Drive files whose job is gone.
 *   2. purgeSyncedSupabaseBinaries — lifecycle: drop the Supabase staging copy 30d
 *                                    after the file is safely archived in Drive.
 *   3. checkDriveQuotaAndAlert    — warn admins when the 15 GB Drive nears full.
 * All best-effort: a failure in one item never stops the rest.
 */

import { createServiceClient } from '@/lib/supabase/service';
import { logAdminAction } from '@/lib/audit/logger';
import { logger } from '@/lib/utils/logger';
import { sendPushToUser } from '@/lib/push/sendPush';
import { getDriveStorage, isDriveConfigured } from './index';
import { extractStoragePath } from './storagePath';
import { findOrphanFileIds, isQuotaOverThreshold } from './driveHousekeepingLogic';

const STORAGE_BUCKET = 'ocr-invoices';

export async function cleanupOrphanDriveFiles(): Promise<{ checked: number; deleted: number }> {
    if (!isDriveConfigured()) return { checked: 0, deleted: 0 };

    const drive = await getDriveStorage();
    const files = await drive.listAppFiles();
    const docIds = files.map((f) => f.documentId).filter((v): v is string => Boolean(v));
    if (docIds.length === 0) return { checked: files.length, deleted: 0 };

    const supabase = createServiceClient();
    const existing = new Set<string>();
    // Chunk the IN() lookup to stay within sane query sizes.
    for (let i = 0; i < docIds.length; i += 200) {
        const { data } = await supabase.from('ocr_jobs').select('id').in('id', docIds.slice(i, i + 200));
        for (const r of data ?? []) existing.add(r.id);
    }

    const orphans = findOrphanFileIds(files, existing);
    let deleted = 0;
    for (const fileId of orphans) {
        try {
            await drive.deleteInvoice(fileId);
            await logAdminAction('rgpd_drive_orphan_deletion', 'ocr_jobs', null, { driveFileId: fileId })
                .catch(() => undefined);
            deleted++;
        } catch (err) {
            logger.warn('[Drive] Orphan delete failed', { fileId, err: err instanceof Error ? err.message : String(err) });
        }
    }
    return { checked: files.length, deleted };
}

export async function purgeSyncedSupabaseBinaries(days = 30): Promise<{ purged: number }> {
    const supabase = createServiceClient();
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const { data: jobs } = await supabase
        .from('ocr_jobs')
        .select('id, file_path')
        .not('drive_synced_at', 'is', null)
        .is('binary_purged_at', null)
        .lt('drive_synced_at', cutoff)
        .not('file_path', 'is', null)
        .limit(200);

    if (!jobs?.length) return { purged: 0 };

    let purged = 0;
    for (const job of jobs) {
        try {
            const path = job.file_path ? extractStoragePath(job.file_path, STORAGE_BUCKET) : null;
            if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
            await supabase.from('ocr_jobs').update({ binary_purged_at: new Date().toISOString() }).eq('id', job.id);
            purged++;
        } catch (err) {
            logger.warn('[Drive] Binary purge failed (will retry)', { jobId: job.id, err: err instanceof Error ? err.message : String(err) });
        }
    }
    return { purged };
}

export async function checkDriveQuotaAndAlert(
    threshold = 0.8,
): Promise<{ usage: number; limit: number | null; alerted: boolean }> {
    if (!isDriveConfigured()) return { usage: 0, limit: null, alerted: false };

    const drive = await getDriveStorage();
    const { usage, limit } = await drive.getStorageQuota();
    if (!isQuotaOverThreshold(usage, limit, threshold)) return { usage, limit, alerted: false };

    const supabase = createServiceClient();
    const { data: admins } = await supabase.from('profiles').select('id').eq('role', 'admin');
    const pct = limit ? Math.round((usage / limit) * 100) : 0;
    const title = 'Drive de facturas casi lleno';
    const message = `El Drive de facturas está al ${pct}% de su capacidad. Considera migrar a Google Workspace o liberar espacio.`;

    for (const admin of admins ?? []) {
        await supabase.from('notifications').insert({ user_id: admin.id, title, message, type: 'warning', link: '/dashboard/invoices' });
        await sendPushToUser(admin.id, { title, body: `Almacenamiento al ${pct}%` }).catch(() => undefined);
    }
    return { usage, limit, alerted: true };
}
