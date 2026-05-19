import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendPushToUser } from '@/lib/push/sendPush';
import { moduleLogger } from '@/lib/logger';
import { resend } from '@/lib/resend';
import { buildWeeklySummaryContent } from '@/lib/reports/weeklySummary';

const log = moduleLogger('cron:weekly-summary');

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
    const authHeader = request.headers.get('authorization');
    if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createServiceClient();

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 86_400_000).toISOString();

    // Get all active agents
    const { data: agents } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['agent', 'franchise']);

    if (!agents?.length) return NextResponse.json({ success: true, agents: 0 });

    const results: { agentId: string; push: boolean; notification: boolean; email: boolean }[] = [];

    for (const agent of agents) {
        const delivery = { agentId: agent.id, push: false, notification: false, email: false };
        try {
            // 1. Urgent follow-ups (sent >7d)
            const { count: urgentCount } = await supabase
                .from('proposals')
                .select('id', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('status', 'sent')
                .lt('updated_at', weekAgo);

            // 2. New clients without proposal
            const { data: newClients } = await supabase
                .from('clients')
                .select('id')
                .eq('owner_id', agent.id)
                .in('status', ['new', 'contacted']);

            let unauditedCount = 0;
            if (newClients?.length) {
                const { data: withProp } = await supabase
                    .from('proposals')
                    .select('client_id')
                    .in('client_id', newClients.map(c => c.id));
                const covered = new Set((withProp ?? []).map(p => p.client_id));
                unauditedCount = newClients.filter(c => !covered.has(c.id)).length;
            }

            // 3. Proposals accepted this week
            const { count: wonThisWeek } = await supabase
                .from('proposals')
                .select('id', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('status', 'accepted')
                .gte('updated_at', weekAgo);

            // 4. Commissions pending approval
            const { count: pendingComms } = await supabase
                .from('network_commissions')
                .select('id', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('status', 'pending');

            // 5. Proposals accepted last 30 days → conversion rate
            const { count: total30d } = await supabase
                .from('proposals')
                .select('id', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .gte('created_at', monthAgo);

            const { count: won30d } = await supabase
                .from('proposals')
                .select('id', { count: 'exact', head: true })
                .eq('agent_id', agent.id)
                .eq('status', 'accepted')
                .gte('created_at', monthAgo);

            const convRate = total30d ? Math.round(((won30d ?? 0) / total30d) * 100) : 0;

            const content = buildWeeklySummaryContent({
                wonThisWeek: wonThisWeek ?? 0,
                urgentFollowups: urgentCount ?? 0,
                unauditedClients: unauditedCount,
                pendingCommissions: pendingComms ?? 0,
                conversionRate30d: convRate,
            }, now);

            if (content.hasActionableItems) {
                const { error: notificationError } = await supabase.from('notifications').insert({
                    user_id: agent.id,
                    title: content.title,
                    message: content.body,
                    type: 'info',
                    link: '/dashboard',
                    read: false,
                    expires_at: new Date(now.getTime() + 14 * 86_400_000).toISOString(),
                });
                delivery.notification = !notificationError;

                try {
                    await sendPushToUser(agent.id, {
                        title: content.title,
                        body: content.body,
                        url: '/dashboard',
                        icon: '/icon-192.png',
                    });
                    delivery.push = true;
                } catch (pushError) {
                    log.warn({ err: pushError, agentId: agent.id }, 'Weekly summary push failed for agent');
                }

                if (process.env.RESEND_API_KEY && agent.email) {
                    const { error: emailError } = await resend.emails.send({
                        from: process.env.RESEND_FROM || 'Zinergia <onboarding@resend.dev>',
                        to: [agent.email],
                        subject: content.title,
                        html: content.html,
                    });
                    delivery.email = !emailError;
                    if (emailError) {
                        log.warn({ err: emailError, agentId: agent.id }, 'Weekly summary email failed for agent');
                    }
                }
            }

            results.push(delivery);
        } catch (e) {
            log.warn({ err: e, agentId: agent.id }, 'Weekly summary failed for agent');
            results.push(delivery);
        }
    }

    log.info({
        push: results.filter(r => r.push).length,
        notification: results.filter(r => r.notification).length,
        email: results.filter(r => r.email).length,
        total: results.length,
    }, 'Weekly summary done');
    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
}
