import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { moduleLogger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/push/sendPush';
import { buildPermanenceReminder } from '@/lib/invoices/permanenceReminder';

const log = moduleLogger('cron:permanence-reminders');
const CRON_SECRET = process.env.CRON_SECRET;

// Avisar cuando la permanencia vence dentro de este margen.
const REMINDER_WINDOW_DAYS = 30;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = createServiceClient();
        const until = new Date(Date.now() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000)
            .toISOString()
            .slice(0, 10);

        const { data: jobs, error } = await supabase
            .from('ocr_jobs')
            .select('id, agent_id, closed_company, permanence_until')
            .eq('closed', true)
            .is('permanence_reminded_at', null)
            .not('permanence_until', 'is', null)
            .lte('permanence_until', until);

        if (error) {
            Sentry.captureException(error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        if (!jobs?.length) return NextResponse.json({ success: true, reminded: 0 });

        let reminded = 0;
        for (const job of jobs) {
            if (!job.agent_id || !job.permanence_until) continue;
            const reminder = buildPermanenceReminder({
                company: job.closed_company,
                permanenceUntil: job.permanence_until,
            });

            await supabase.from('notifications').insert({
                user_id: job.agent_id,
                title: reminder.title,
                message: reminder.message,
                type: reminder.type,
                link: reminder.link,
            });
            await sendPushToUser(job.agent_id, { title: reminder.title, body: reminder.message })
                .catch(() => undefined);
            await supabase
                .from('ocr_jobs')
                .update({ permanence_reminded_at: new Date().toISOString() })
                .eq('id', job.id);
            reminded++;
        }

        log.info({ reminded }, 'permanence reminders sent');
        return NextResponse.json({ success: true, reminded, timestamp: new Date().toISOString() });
    } catch (error) {
        Sentry.captureException(error);
        log.error({ err: error }, 'permanence reminders failed');
        const message = error instanceof Error ? error.message : 'unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
