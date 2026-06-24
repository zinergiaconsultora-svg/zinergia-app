import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { moduleLogger } from '@/lib/logger';
import { purgeClientDriveFiles } from '@/lib/drive/purgeClientDriveFiles';

const log = moduleLogger('cron:purge-clients');

// Called daily by Vercel Cron — protected by CRON_SECRET header
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createServiceClient();

    // RGPD cascade: delete the Drive invoice files of the clients about to be
    // purged BEFORE the SQL cascade removes their ocr_jobs. Mirrors the
    // eligibility of purge_expired_clients() (won > 5y, inactive > 12m). The
    // reconciliation job is the backstop for any boundary drift.
    try {
        const wonCutoff = new Date(Date.now() - 5 * 365 * 24 * 60 * 60 * 1000).toISOString();
        const inactiveCutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
        const { data: eligible } = await supabaseAdmin
            .from('clients')
            .select('id')
            .or(
                `and(status.eq.won,updated_at.lt.${wonCutoff}),` +
                `and(status.in.(lost,new,contacted,in_process),updated_at.lt.${inactiveCutoff})`,
            );
        const ids = (eligible ?? []).map((c) => c.id);
        if (ids.length > 0) {
            const res = await purgeClientDriveFiles(ids);
            log.info({ ...res }, 'RGPD Drive purge before client purge');
        }
    } catch (e) {
        Sentry.captureException(e);
        log.error({ err: e }, 'RGPD Drive purge step failed (continuing with DB purge)');
    }

    // Call the SQL function that purges expired clients and writes audit logs
    const { data, error } = await supabaseAdmin.rpc('purge_expired_clients');

    if (error) {
        Sentry.captureException(error);
        log.error({ err: error }, 'purge_expired_clients RPC failed');
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const deleted = data as number ?? 0;
    log.info({ deleted }, 'purge_expired_clients completed');

    return NextResponse.json({
        success: true,
        deleted,
        timestamp: new Date().toISOString(),
    });
}
