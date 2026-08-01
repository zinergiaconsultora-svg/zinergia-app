import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { moduleLogger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/push/sendPush';

const log = moduleLogger('cron:detect-renewals');

type RenewalReconciliationRow = {
    contract_id: string;
    opportunity_id: string;
    owner_id: string;
    threshold_days: number;
    opportunity_created: boolean;
    reminder_created: boolean;
};

export async function GET(request: Request) {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createServiceClient();
        const asOf = new Date().toISOString().slice(0, 10);
        const { data, error } = await supabase.rpc('reconcile_contract_renewals', {
            p_as_of: asOf,
        });

        if (error) throw error;

        const rows = (data ?? []) as RenewalReconciliationRow[];
        const newReminders = rows.filter(row => row.reminder_created);
        let pushesSent = 0;

        await Promise.all(newReminders.map(async (row) => {
            const threshold = row.threshold_days;
            const title = threshold === 0 ? 'Contrato vencido' : 'Vencimiento próximo';
            const body = threshold === 0
                ? 'Revisa hoy la renovación del contrato.'
                : `Revisa la renovación: vence en ${threshold} días.`;

            try {
                await sendPushToUser(row.owner_id, {
                    title,
                    body,
                    url: `/dashboard/opportunities/${row.opportunity_id}`,
                });
                pushesSent++;
            } catch {
                // The durable in-app reminder is already stored; push remains best effort.
            }
        }));

        const result = {
            eligibleContracts: rows.length,
            opportunitiesCreated: rows.filter(row => row.opportunity_created).length,
            remindersCreated: newReminders.length,
            pushesSent,
        };
        log.info(result, 'Canonical contract renewal reconciliation complete');
        return NextResponse.json(result);
    } catch (error) {
        Sentry.captureException(error);
        log.error({ err: error }, 'Canonical contract renewal reconciliation failed');
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
