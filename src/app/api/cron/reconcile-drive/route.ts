import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { moduleLogger } from '@/lib/logger';
import { reconcilePendingDriveArchives } from '@/lib/drive/reconcilePendingArchives';
import {
    cleanupOrphanDriveFiles,
    purgeSyncedSupabaseBinaries,
    checkDriveQuotaAndAlert,
} from '@/lib/drive/driveHousekeeping';

const log = moduleLogger('cron:reconcile-drive');

// Called daily by Vercel Cron — protected by CRON_SECRET header.
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        // Each step is independent and best-effort; one failure shouldn't block the rest.
        const retry = await reconcilePendingDriveArchives(50).catch((e) => {
            Sentry.captureException(e);
            return { processed: 0, archived: 0, failed: 0 };
        });
        const orphans = await cleanupOrphanDriveFiles().catch((e) => {
            Sentry.captureException(e);
            return { checked: 0, deleted: 0 };
        });
        const lifecycle = await purgeSyncedSupabaseBinaries(30).catch((e) => {
            Sentry.captureException(e);
            return { purged: 0 };
        });
        const quota = await checkDriveQuotaAndAlert(0.8).catch((e) => {
            Sentry.captureException(e);
            return { usage: 0, limit: null, alerted: false };
        });

        log.info({ retry, orphans, lifecycle, quotaAlerted: quota.alerted }, 'drive housekeeping completed');
        return NextResponse.json({
            success: true,
            retry,
            orphans,
            lifecycle,
            quota,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        Sentry.captureException(error);
        log.error({ err: error }, 'drive housekeeping failed');
        const message = error instanceof Error ? error.message : 'unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
