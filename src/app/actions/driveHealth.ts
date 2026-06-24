'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { requireServerRole } from '@/lib/auth/permissions';
import { logger } from '@/lib/utils/logger';
import { getDriveStorage, isDriveConfigured, resetDriveStorageCache } from '@/lib/drive/index';
import { reconcilePendingDriveArchives } from '@/lib/drive/reconcilePendingArchives';
import { saveDriveRefreshToken } from '@/lib/drive/credentials';

export interface DriveRgpdEvent {
    action: string;
    recordId: string | null;
    driveFileId: string | null;
    createdAt: string;
}

export interface DriveHealth {
    configured: boolean;
    connected: boolean;
    status: 'active' | 'degraded' | null;
    lastError: string | null;
    updatedAt: string | null;
    sync: { total: number; archived: number; pending: number; failed: number };
    quota: { usage: number; limit: number | null } | null;
    quotaError: string | null;
    rgpd: DriveRgpdEvent[];
}

/** Operational health of the invoice/Drive subsystem. Admin only. */
export async function getDriveHealthAction(): Promise<DriveHealth> {
    await requireServerRole(['admin']);
    const supabase = createServiceClient();

    const [cred, total, archived, pending, failed, audit] = await Promise.all([
        supabase.from('integration_credentials').select('status, last_error, updated_at').eq('provider', 'google_drive').maybeSingle(),
        supabase.from('ocr_jobs').select('id', { count: 'exact', head: true }),
        supabase.from('ocr_jobs').select('id', { count: 'exact', head: true }).not('drive_synced_at', 'is', null),
        supabase.from('ocr_jobs').select('id', { count: 'exact', head: true }).is('drive_synced_at', null),
        supabase.from('ocr_jobs').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('audit_logs')
            .select('action, record_id, new_data, created_at')
            .in('action', ['rgpd_drive_deletion', 'rgpd_drive_orphan_deletion'])
            .order('created_at', { ascending: false })
            .limit(8),
    ]);

    const connected = Boolean(cred.data);
    const configured = isDriveConfigured();
    let quota: DriveHealth['quota'] = null;
    let quotaError: string | null = null;
    if (!configured) {
        quotaError = 'Variables GOOGLE_DRIVE_* no disponibles en el runtime (env no cargado).';
    } else if (!connected) {
        quotaError = 'Sin fila en integration_credentials.';
    } else {
        try {
            const drive = await getDriveStorage();
            quota = await drive.getStorageQuota();
        } catch (err) {
            quotaError = err instanceof Error ? err.message : String(err);
            logger.warn('[driveHealth] quota check failed', { err: quotaError });
        }
    }

    const rgpd: DriveRgpdEvent[] = (audit.data ?? []).map((r) => ({
        action: r.action,
        recordId: r.record_id,
        driveFileId: (r.new_data as Record<string, unknown> | null)?.driveFileId as string ?? null,
        createdAt: r.created_at,
    }));

    return {
        configured: isDriveConfigured(),
        connected,
        status: (cred.data?.status as 'active' | 'degraded' | undefined) ?? null,
        lastError: cred.data?.last_error ?? null,
        updatedAt: cred.data?.updated_at ?? null,
        sync: {
            total: total.count ?? 0,
            archived: archived.count ?? 0,
            pending: pending.count ?? 0,
            failed: failed.count ?? 0,
        },
        quota,
        quotaError,
        rgpd,
    };
}

/** Manually run the Drive reconciliation (retry pending archives). Admin only. */
export async function triggerDriveReconcileAction(): Promise<{ processed: number; archived: number; failed: number }> {
    await requireServerRole(['admin']);
    return reconcilePendingDriveArchives(50);
}

/**
 * Connects/reconnects Drive by encrypting the refresh token IN the prod runtime
 * (with the prod APP_ENCRYPTION_KEY) and saving it. This is the correct way to
 * store the token so decryption succeeds — avoids any key mismatch. Admin only.
 */
export async function connectDriveAction(refreshToken: string): Promise<{ success: boolean; message?: string }> {
    await requireServerRole(['admin']);
    const token = refreshToken?.trim();
    if (!token || token.length < 20) {
        return { success: false, message: 'El token no parece válido.' };
    }
    try {
        await saveDriveRefreshToken(token);
        resetDriveStorageCache();
        return { success: true };
    } catch (e) {
        logger.error('[driveHealth] connectDriveAction failed', { err: e instanceof Error ? e.message : String(e) });
        return { success: false, message: e instanceof Error ? e.message : 'Error al guardar el token' };
    }
}
