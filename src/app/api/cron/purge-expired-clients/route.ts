import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { moduleLogger } from '@/lib/logger';

const log = moduleLogger('cron:purge-clients');

// Called daily by Vercel Cron — protected by CRON_SECRET header
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseAdmin = createServiceClient();

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
