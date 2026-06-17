'use server';

import { createClient } from '@/lib/supabase/server';
import { requireServerRole } from '@/lib/auth/permissions';

export interface AgendaTask {
    id: string;
    title: string;
    due_date: string | null;
    priority: string;
    client_name: string | null;
    client_id: string | null;
}

export interface ColdProposal {
    id: string;
    client_name: string;
    annual_savings: number;
    sent_date: string;
    days_since_sent: number;
}

export interface AgendaTodayData {
    overdueTasks: AgendaTask[];
    todayTasks: AgendaTask[];
    coldProposals: ColdProposal[];
}

export async function getAgendaTodayAction(): Promise<AgendaTodayData> {
    await requireServerRole(['admin', 'franchise', 'agent']);

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { overdueTasks: [], todayTasks: [], coldProposals: [] };

    const today = new Date().toISOString().split('T')[0];

    const [overdueRes, todayRes, coldRes] = await Promise.all([
        supabase
            .from('next_actions')
            .select('id, title, due_date, priority, client_id, clients(name)')
            .eq('agent_id', user.id)
            .is('completed_at', null)
            .lt('due_date', today)
            .order('due_date', { ascending: true })
            .limit(10),

        supabase
            .from('next_actions')
            .select('id, title, due_date, priority, client_id, clients(name)')
            .eq('agent_id', user.id)
            .is('completed_at', null)
            .eq('due_date', today)
            .order('priority', { ascending: true })
            .limit(10),

        supabase
            .from('proposals')
            .select('id, annual_savings, sent_date, clients(name)')
            .eq('agent_id', user.id)
            .eq('status', 'sent')
            .not('sent_date', 'is', null)
            .order('sent_date', { ascending: true })
            .limit(20),
    ]);

    const now = Date.now();
    const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

    const coldProposals: ColdProposal[] = (coldRes.data || [])
        .filter(p => {
            const sentMs = new Date(p.sent_date!).getTime();
            return (now - sentMs) > THREE_DAYS_MS;
        })
        .slice(0, 5)
        .map(p => ({
            id: p.id,
            client_name: (p.clients as unknown as { name: string } | null)?.name || 'Cliente',
            annual_savings: p.annual_savings,
            sent_date: p.sent_date!,
            days_since_sent: Math.floor((now - new Date(p.sent_date!).getTime()) / (24 * 60 * 60 * 1000)),
        }));

    const mapTask = (t: Record<string, unknown>): AgendaTask => ({
        id: t.id as string,
        title: t.title as string,
        due_date: t.due_date as string | null,
        priority: t.priority as string,
        client_name: (t.clients as { name: string } | null)?.name || null,
        client_id: t.client_id as string | null,
    });

    return {
        overdueTasks: (overdueRes.data || []).map(t => mapTask(t as unknown as Record<string, unknown>)),
        todayTasks: (todayRes.data || []).map(t => mapTask(t as unknown as Record<string, unknown>)),
        coldProposals,
    };
}
