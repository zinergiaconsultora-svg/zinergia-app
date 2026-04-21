import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';

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
        console.error('[PurgeExpiredClients] RPC error:', error.message);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const deleted = data as number ?? 0;
    console.log(`[PurgeExpiredClients] Deleted ${deleted} client(s) — ${new Date().toISOString()}`);

    return NextResponse.json({
        success: true,
        deleted,
        timestamp: new Date().toISOString(),
    });
}
