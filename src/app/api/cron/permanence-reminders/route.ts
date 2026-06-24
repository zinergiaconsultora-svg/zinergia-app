import { NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createServiceClient } from '@/lib/supabase/service';
import { moduleLogger } from '@/lib/logger';
import { sendPushToUser } from '@/lib/push/sendPush';
import { buildPermanenceReminder } from '@/lib/invoices/permanenceReminder';
import { writeLeadAuditEvent } from '@/lib/audit/leadAuditLog';

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
            .select('id, agent_id, closed_company, permanence_until, extracted_data')
            .eq('closed', true)
            .is('permanence_reminded_at', null)
            .not('permanence_until', 'is', null)
            .lte('permanence_until', until);

        if (error) {
            Sentry.captureException(error);
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }
        if (!jobs?.length) return NextResponse.json({ success: true, reminded: 0 });

        const { data: admins } = await supabase
            .from('profiles')
            .select('id')
            .eq('role', 'admin');
        const adminIds = new Set((admins ?? []).map((admin) => admin.id).filter(Boolean));

        let reminded = 0;
        let notificationsSent = 0;
        for (const job of jobs) {
            if (!job.agent_id || !job.permanence_until) continue;
            const reminder = buildPermanenceReminder({
                company: job.closed_company,
                permanenceUntil: job.permanence_until,
            });
            const extracted = job.extracted_data as Record<string, unknown> | null;
            const clientName = typeof extracted?.client_name === 'string' ? extracted.client_name : null;
            const adminMessage = clientName
                ? `${clientName}: ${reminder.message}`
                : reminder.message;

            const notifications = [
                {
                    user_id: job.agent_id,
                    title: reminder.title,
                    message: reminder.message,
                    type: reminder.type,
                    link: reminder.link,
                },
                ...Array.from(adminIds).map((adminId) => ({
                    user_id: adminId,
                    title: 'Lead con permanencia próxima',
                    message: adminMessage,
                    type: reminder.type,
                    link: '/admin/leads?queue=permanence_due',
                })),
            ];

            const { error: notificationError } = await supabase.from('notifications').insert(notifications);
            if (notificationError) {
                log.warn({ err: notificationError, jobId: job.id }, 'permanence notification insert failed');
            } else {
                notificationsSent += notifications.length;
            }

            const pushRecipients = new Set<string>([job.agent_id, ...adminIds]);
            await Promise.all(Array.from(pushRecipients).map((userId) =>
                sendPushToUser(userId, {
                    title: adminIds.has(userId) ? 'Lead con permanencia próxima' : reminder.title,
                    body: adminIds.has(userId) ? adminMessage : reminder.message,
                    url: adminIds.has(userId) ? '/admin/leads?queue=permanence_due' : reminder.link,
                }).catch(() => undefined)
            ));

            await writeLeadAuditEvent({
                jobId: job.id,
                actorId: null,
                eventType: 'note_added',
                title: 'Recordatorio de permanencia enviado',
                detail: adminMessage,
                metadata: {
                    permanenceUntil: job.permanence_until,
                    adminRecipients: Array.from(adminIds).length,
                    agentNotified: Boolean(job.agent_id),
                },
            }).catch(() => undefined);

            await supabase
                .from('ocr_jobs')
                .update({ permanence_reminded_at: new Date().toISOString() })
                .eq('id', job.id);
            reminded++;
        }

        log.info({ reminded, notificationsSent }, 'permanence reminders sent');
        return NextResponse.json({ success: true, reminded, notificationsSent, timestamp: new Date().toISOString() });
    } catch (error) {
        Sentry.captureException(error);
        log.error({ err: error }, 'permanence reminders failed');
        const message = error instanceof Error ? error.message : 'unknown error';
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
