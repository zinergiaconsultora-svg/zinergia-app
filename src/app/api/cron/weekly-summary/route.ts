import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { sendPushToUser } from '@/lib/push/sendPush';
import { moduleLogger } from '@/lib/logger';

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

    const results: { agentId: string; sent: boolean }[] = [];

    for (const agent of agents) {
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

            // Build push body
            const lines: string[] = [];
            if (wonThisWeek) lines.push(`🏆 ${wonThisWeek} venta${wonThisWeek > 1 ? 's' : ''} esta semana`);
            if (urgentCount) lines.push(`🔴 ${urgentCount} seguimiento${urgentCount > 1 ? 's' : ''} urgente${urgentCount > 1 ? 's' : ''}`);
            if (unauditedCount) lines.push(`📋 ${unauditedCount} cliente${unauditedCount > 1 ? 's' : ''} sin auditoría`);
            if (pendingComms) lines.push(`💰 ${pendingComms} comisión${pendingComms > 1 ? 'es' : ''} pendiente${pendingComms > 1 ? 's' : ''}`);
            lines.push(`📈 Conversión 30d: ${convRate}%`);

            if (lines.length > 0) {
                await sendPushToUser(agent.id, {
                    title: `Resumen semanal · ${now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' })}`,
                    body: lines.join(' · '),
                    url: '/dashboard',
                    icon: '/icon-192.png',
                });
            }

            results.push({ agentId: agent.id, sent: true });
        } catch (e) {
            log.warn({ err: e, agentId: agent.id }, 'Weekly summary push failed for agent');
            results.push({ agentId: agent.id, sent: false });
        }
    }

    log.info({ sent: results.filter(r => r.sent).length, total: results.length }, 'Weekly summary done');
    return NextResponse.json({ success: true, results, timestamp: now.toISOString() });
}
